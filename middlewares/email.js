const nodemailer = require('nodemailer');

// Configurar transporter con tus datos (YA CONFIGURADO)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'dvwilker40@gmail.com',
        pass: 'nhvz ddkk dvlg zcqp'
    }
});

// Enviar código de verificación
async function enviarCodigoVerificacion(email, codigo) {
    try {
        const info = await transporter.sendMail({
            from: `"DvWilkerOFC API" <dvwilker40@gmail.com>`,
            to: email,
            subject: '🔐 Verifica tu cuenta - DvWilkerOFC API',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0d0d0d; color: #fff; padding: 30px; border-radius: 20px;">
                    <h2 style="color: #00f3ff; text-align: center;">DVWILKER OFC</h2>
                    <h3 style="text-align: center;">Verifica tu cuenta</h3>
                    <p>Haz clic en el botón para verificar tu cuenta:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.APP_URL || 'https://dvwilkerofc-v1.onrender.com'}/verify?code=${codigo}&email=${email}" style="background: #00f3ff; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 50px; font-weight: bold;">Verificar cuenta</a>
                    </div>
                    <p>O ingresa este código manualmente: <strong style="color: #00f3ff; font-size: 20px;">${codigo}</strong></p>
                    <p style="font-size: 12px; color: #666;">Este código expira en 10 minutos.</p>
                    <hr style="border-color: #333;">
                    <p style="font-size: 10px; color: #666; text-align: center;">© 2026 DvWilkerOFC API</p>
                </div>
            `
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error enviando email:', error);
        return { success: false, error: error.message };
    }
}

module.exports = { enviarCodigoVerificacion };