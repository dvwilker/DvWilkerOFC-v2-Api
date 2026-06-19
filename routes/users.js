const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { generateKey } = require('../middlewares/auth');
const { findUser, createUser, getAllUsers, updateUser, deleteUser } = require('../db');

// ============== CONFIGURACIÓN ==============
const adminPath = path.join(__dirname, '../database/users.json');
let adminUser = null;
try {
    const adminData = JSON.parse(fs.readFileSync(adminPath, 'utf-8'));
    adminUser = Array.isArray(adminData) ? adminData[0] : adminData;
    console.log('✅ Admin cargado desde JSON:', adminUser.username);
} catch (err) {
    console.error('❌ Error cargando admin desde JSON:', err.message);
}

let startTime = Date.now();

// ============== FUNCIÓN PARA VERIFICAR EXPIRACIÓN ==============
function verificarExpiracion(user) {
    if (user.vipExpires && new Date() > new Date(user.vipExpires)) {
        user.role = 'user';
        user.plan = 'free';
        user.limit = 100;
        user.vipSince = null;
        user.vipExpires = null;
        updateUser(user.id, user);
        return true;
    }
    return false;
}

// ============== REGISTRO ==============
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: false, message: "Faltan datos obligatorios" });
    }

    if (adminUser && email === adminUser.email) {
        return res.status(400).json({ status: false, message: "Este email no puede ser registrado" });
    }

    try {
        const existingUser = findUser('email', email) || findUser('username', username);
        if (existingUser) {
            return res.status(400).json({ status: false, message: "El correo o usuario ya existe" });
        }

        const newUser = createUser({
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
            profile_img: "https://raw.githubusercontent.com/dvwilker/gohan-storage/main/1778169562859-IMG-20260504-WA0386.jpg",
            createdAt: new Date().toISOString(),
            vipSince: null,
            vipExpires: null
        });

        res.json({ status: true, creator: "Félix Ofc", message: "Registro exitoso", key: newUser.key });
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

        let user = findUser('email', email);
        if (!user || user.password !== password) {
            return res.status(401).json({ status: false, message: "Credenciales incorrectas" });
        }

        verificarExpiracion(user);

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

        let user = findUser('key', apiKey);
        if (!user) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

        verificarExpiracion(user);

        let daysLeft = 0;
        if (user.vipExpires) {
            daysLeft = Math.ceil((new Date(user.vipExpires) - new Date()) / (1000 * 60 * 60 * 24));
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
                profile_img: user.profile_img,
                vipExpires: user.vipExpires,
                daysLeft: daysLeft,
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

// ============== ACTUALIZAR PERFIL (PROTEGIDO) ==============
router.post('/update-profile', async (req, res) => {
    const { apiKey, type, value } = req.body;

    if (!apiKey || !type || value === undefined) {
        return res.status(400).json({ status: false, message: "Faltan parámetros" });
    }

    const forbiddenFields = ['role', 'plan', 'limit', 'vipSince', 'vipExpires', 'totalRequest', 'requestToday', 'key', 'verified'];
    if (forbiddenFields.includes(type)) {
        return res.status(403).json({ 
            status: false, 
            message: "No puedes modificar este campo. Solo el administrador puede cambiar roles y planes." 
        });
    }

    try {
        if (adminUser && apiKey === adminUser.key) {
            return res.status(403).json({ status: false, message: "El admin solo se modifica manualmente en users.json" });
        }

        let user = findUser('key', apiKey);
        if (!user) {
            return res.status(404).json({ status: false, message: "Llave maestra inválida" });
        }

        const allowedFields = ['username', 'email', 'password', 'profile_img'];
        if (!allowedFields.includes(type)) {
            return res.status(400).json({ status: false, message: "Acción no permitida para este campo" });
        }

        user[type] = value;
        updateUser(user.id, user);

        res.json({ status: true, message: "Protocolo actualizado", field: type });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

// ============== ESTADÍSTICAS ==============
router.get('/stats', async (req, res) => {
    try {
        const allUsers = getAllUsers();
        const totalUsers = allUsers.length + (adminUser ? 1 : 0);
        res.json({ status: true, users: totalUsers, endpoints: 50 });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== DASHBOARD GLOBAL ==============
router.get('/dashboard-global', async (req, res) => {
    try {
        const allUsers = getAllUsers();
        const totalUsers = allUsers.length + (adminUser ? 1 : 0);

        let topUsers = allUsers
            .filter(u => u.totalRequest > 0)
            .sort((a, b) => b.totalRequest - a.totalRequest)
            .slice(0, 5)
            .map(u => ({
                username: u.username,
                total: u.totalRequest,
                initial: u.username.charAt(0).toUpperCase()
            }));

        if (adminUser && adminUser.totalRequest > 0 && topUsers.length < 5) {
            topUsers.push({
                username: adminUser.username,
                total: adminUser.totalRequest,
                initial: adminUser.username.charAt(0).toUpperCase()
            });
            topUsers.sort((a, b) => b.total - a.total);
        }

        let globalRequests = allUsers.reduce((sum, u) => sum + (u.totalRequest || 0), 0);
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
        let isAdmin = false;
        if (adminUser && apiKey === adminUser.key) {
            isAdmin = true;
        } else {
            const user = findUser('key', apiKey);
            isAdmin = user && user.role === 'admin';
        }

        if (!isAdmin) return res.status(403).json({ status: false, message: "No autorizado" });

        let allUsers = getAllUsers();
        if (adminUser) {
            allUsers.unshift({
                username: adminUser.username,
                email: adminUser.email,
                key: adminUser.key,
                role: 'admin',
                plan: 'ADMIN VIP',
                limit: adminUser.limit,
                totalRequest: adminUser.totalRequest || 0
            });
        }

        res.json({ status: true, users: allUsers });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: ACTUALIZAR ==============
router.post('/admin/update', async (req, res) => {
    const { adminKey, targetEmail, newData } = req.body;

    try {
        let isAdmin = false;
        if (adminUser && adminKey === adminUser.key) {
            isAdmin = true;
        } else {
            const user = findUser('key', adminKey);
            isAdmin = user && user.role === 'admin';
        }

        if (!isAdmin) return res.status(403).json({ status: false });

        if (adminUser && targetEmail === adminUser.email) {
            return res.status(403).json({ status: false, message: "No se puede modificar el admin desde aquí" });
        }

        let user = findUser('email', targetEmail);
        if (!user) {
            return res.status(404).json({ status: false });
        }

        Object.assign(user, newData);
        updateUser(user.id, user);

        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: ELIMINAR ==============
router.post('/admin/delete', async (req, res) => {
    const { adminKey, targetEmail } = req.body;

    try {
        let isAdmin = false;
        if (adminUser && adminKey === adminUser.key) {
            isAdmin = true;
        } else {
            const user = findUser('key', adminKey);
            isAdmin = user && user.role === 'admin';
        }

        if (!isAdmin) return res.status(403).json({ status: false });

        if (adminUser && targetEmail === adminUser.email) {
            return res.status(403).json({ status: false, message: "No se puede eliminar el admin" });
        }

        const user = findUser('email', targetEmail);
        if (!user) {
            return res.status(404).json({ status: false });
        }

        deleteUser(user.id);
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

module.exports = router;