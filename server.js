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

// 1. HTTP Security Headers (Adjusted to allow local development scripts)
app.use(helmet({
  contentSecurityPolicy: false, 
}));

// 2. CORS (Cross-Origin Resource Sharing) - RE-CONFIGURED RIGHT
// ফ্রন্টএন্ড পোর্ট ৩০০০ কে ব্যাকএন্ড পোর্ট ৫০০০ এর সাথে ফুল এক্সেস দেওয়া হলো
const corsOptions = {
  origin: ['http://localhost:3000', 'https://your-live-website.com'], 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// 3. Rate Limiting 
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 500, // লিমিট বাড়িয়ে ৫০০ করা হলো যাতে ড্যাশবোর্ড লোডিং ব্লক না হয়
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// =======================================================
// ⚠️ THE CRITICAL ORDER: JSON parser MUST be right here!
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// =======================================================

// 4 & 5. Combo Security Shield (NoSQL & XSS Cleaner)
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
    maxPoolSize: 100, // Opens 100 parallel lanes for data traffic
    serverSelectionTimeoutMS: 5000, // Fails fast instead of hanging forever
    socketTimeoutMS: 45000, // Closes dead connections to save memory
})
.then(() => console.log('🟢 MongoDB Connected via High-Speed Pool'))
.catch(err => console.log('🔴 MongoDB Error:', err));
  .then(() => console.log('✅ MongoDB Engine Connected'))
  .catch((err) => console.log('❌ Database connection failed:', err));

// ================= AUTO-DEPLOY COMMANDER ACCOUNT =================
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
// =================================================================

// Basic Test Route
app.get('/', (req, res) => {
  res.send('SAWN BD API is running...');
});

// Routes Links
app.use('/api/auth', require('./routes/auth'));
app.use('/api/curriculum', require('./routes/curriculum'));
app.use('/api/assignments', require('./routes/assignments')); 
app.use('/api/admin', require('./routes/admin'));
app.use('/api/enrollment', require('./routes/enrollment'));

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server initialized on port ${PORT}`);
});