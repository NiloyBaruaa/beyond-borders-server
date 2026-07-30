const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const User = require('./models/User'); 
const bcrypt = require('bcryptjs');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

const corsOptions = {
  origin: ['http://localhost:3000', 'https://sawnbd.com', 'https://www.sawnbd.com', 'https://sawnbd.vercel.app'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, 
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.query) mongoSanitize.sanitize(req.query);
  if (req.params) mongoSanitize.sanitize(req.params);

  const cleanXSS = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/</g, '&lt;').replace(/>/g, '&gt;');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        cleanXSS(obj[key]);
      }
    }
  };

  if (req.body) cleanXSS(req.body);
  if (req.query) cleanXSS(req.query);
  if (req.params) cleanXSS(req.params);
  next();
});

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 100,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('🟢 MongoDB Connected via High-Speed Pool'))
.catch(err => console.log('🔴 MongoDB Error:', err));

// Auto-Deploy Commander Account
const createCommanderAccount = async () => {
    try {
        const commanderEmail = 'niloybaruaofficial@gmail.com';
        const existingCommander = await User.findOne({ email: commanderEmail });
        
        if (!existingCommander) {
            console.log('⚙️ Deploying Commander Root Account...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('Niloy160892@', salt);
            
            const commander = new User({
                name: 'Niloy Baruaa',
                email: commanderEmail,
                password: hashedPassword,
                phone: '01632785301', 
                role: 'superadmin'
            });
            await commander.save();
            console.log('✅ Commander Account Deployed Successfully.');
        } else {
            console.log('✅ Commander Account is active and secure.');
        }
    } catch (err) {
        console.error('❌ Failed to create Commander Account:', err);
    }
};
createCommanderAccount();

app.get('/', (req, res) => {
  res.send('SAWN BD API is running...');
});

// ================= FAILSAFE ROUTE LOADER =================
// This prevents the server from crashing if a file is missing
const loadRouteSafe = (routePath) => {
    try {
        return require(routePath);
    } catch (error) {
        console.error(`⚠️ Failsafe triggered: Could not load ${routePath}. Error: ${error.message}`);
        return (req, res) => res.status(500).json({ message: "This route is currently offline for maintenance." });
    }
};

app.use('/api/auth', loadRouteSafe('./routes/auth'));
app.use('/api/curriculum', loadRouteSafe('./routes/curriculum'));
app.use('/api/assignments', loadRouteSafe('./routes/assignments')); 
app.use('/api/admin', loadRouteSafe('./routes/admin'));
app.use('/api/enrollment', loadRouteSafe('./routes/enrollment'));
// =========================================================

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server initialized on port ${PORT}`);
});