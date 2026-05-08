const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { generateKey } = require('../middlewares/auth');
const { enviarCodigoVerificacion } = require('../middlewares/email');

// ============== CONFIGURACIÓN ==============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://DvWilkerOFC:dvwilker15@dvwilker15.xndilqb.mongodb.net/?appName=dvwilker15';
const MONGODB_DB = process.env.MONGODB_DB || 'wilker_api';

// Leer admin desde JSON
const adminPath = path.join(__dirname, '../database/users.json');
let adminUser = null;
try {
    const adminData = JSON.parse(fs.readFileSync(adminPath, 'utf-8'));
    adminUser = Array.isArray(adminData) ? adminData[0] : adminData;
    console.log('✅ Admin cargado desde JSON:', adminUser.username);
} catch (err) {
    console.error('❌ Error cargando admin desde JSON:', err.message);
}

// Conectar a MongoDB
if (mongoose.connection.readyState === 0) {
    mongoose.connect(`${MONGODB_URI}/${MONGODB_DB}`, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => console.log('✅ Conectado a MongoDB Atlas'))
      .catch(err => console.error('❌ Error MongoDB:', err));
}

// Esquema para usuarios (con verificación)
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
    createdAt: { type: Date, default: Date.now },
    // Verificación de correo
    verified: { type: Boolean, default: false },
    verificationCode: { type: String, default: null },
    verificationExpires: { type: Date, default: null },
    // VIP
    vipSince: { type: Date, default: null },
    vipExpires: { type: Date, default: null }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

let startTime = Date.now();

// Generar código de verificación (6 dígitos)
function generarCodigo() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============== REGISTRO (con verificación) ==============
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: false, message: "Faltan datos obligatorios" });
    }

    if (adminUser && email === adminUser.email) {
        return res.status(400).json({ status: false, message: "Este email no puede ser registrado" });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ status: false, message: "El correo o usuario ya existe" });
        }

        const codigo = generarCodigo();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

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
            lastRequestDate: new Date().toISOString().split('T')[0],
            verified: false,
            verificationCode: codigo,
            verificationExpires: expiresAt
        });

        await newUser.save();

        // Enviar correo de verificación
        const emailResult = await enviarCodigoVerificacion(email, codigo);

        res.json({
            status: true,
            creator: "Félix Ofc",
            message: "Registro exitoso. Revisa tu correo para verificar tu cuenta.",
            key: newUser.key,
            verified: false,
            emailSent: emailResult.success
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error en el servidor durante el registro" });
    }
});

// ============== VERIFICAR CUENTA ==============
router.post('/verify', async (req, res) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return res.status(400).json({ status: false, message: "Email y código requeridos" });
    }

    try {
        const user = await User.findOne({ email, verificationCode: code });
        
        if (!user) {
            return res.status(400).json({ status: false, message: "Código inválido" });
        }

        if (new Date() > new Date(user.verificationExpires)) {
            return res.status(400).json({ status: false, message: "El código ha expirado. Solicita uno nuevo." });
        }

        user.verified = true;
        user.verificationCode = null;
        user.verificationExpires = null;
        await user.save();

        res.json({ status: true, message: "Cuenta verificada exitosamente" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

// ============== REENVIAR CÓDIGO ==============
router.post('/resend-code', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ status: false, message: "Email requerido" });
    }

    try {
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ status: false, message: "Usuario no encontrado" });
        }

        if (user.verified) {
            return res.status(400).json({ status: false, message: "La cuenta ya está verificada" });
        }

        const nuevoCodigo = generarCodigo();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        user.verificationCode = nuevoCodigo;
        user.verificationExpires = expiresAt;
        await user.save();

        await enviarCodigoVerificacion(email, nuevoCodigo);

        res.json({ status: true, message: "Código reenviado a tu correo" });
    } catch (err) {
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

// ============== LOGIN (solo usuarios verificados) ==============
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ status: false, message: "Email y contraseña requeridos" });
    }

    try {
        // Admin del JSON
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
        let user = await User.findOne({ email, password });
        if (!user) {
            return res.status(401).json({ status: false, message: "Credenciales incorrectas" });
        }

        // Verificar si la cuenta está verificada
        if (!user.verified) {
            return res.status(403).json({ 
                status: false, 
                message: "Cuenta no verificada. Revisa tu correo o solicita un nuevo código.",
                verified: false
            });
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

// ============== (EL RESTO DE LAS RUTAS: me, update-profile, stats, dashboard-global, admin/all, etc. se mantienen igual) ==============

module.exports = router;