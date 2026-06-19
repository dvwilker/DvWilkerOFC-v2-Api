const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'registered_users.json');

// Inicializar archivo si no existe
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '[]', 'utf-8');
}

// Leer todos los usuarios
function getAllUsers() {
    try {
        const data = fs.readFileSync(dbPath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

// Guardar todos los usuarios
function saveUsers(users) {
    fs.writeFileSync(dbPath, JSON.stringify(users, null, 2), 'utf-8');
}

// Buscar usuario por campo
function findUser(field, value) {
    const users = getAllUsers();
    return users.find(u => u[field] === value) || null;
}

// Crear usuario
function createUser(userData) {
    const users = getAllUsers();
    const newUser = {
        id: Date.now().toString(),
        ...userData
    };
    users.push(newUser);
    saveUsers(users);
    return newUser;
}

// Actualizar usuario
function updateUser(id, newData) {
    const users = getAllUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index] = { ...users[index], ...newData };
        saveUsers(users);
        return users[index];
    }
    return null;
}

// Eliminar usuario
function deleteUser(id) {
    const users = getAllUsers();
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length !== users.length) {
        saveUsers(filtered);
        return true;
    }
    return false;
}

module.exports = {
    findUser,
    createUser,
    getAllUsers,
    updateUser,
    deleteUser
};
