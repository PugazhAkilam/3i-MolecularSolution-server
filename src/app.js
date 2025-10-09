const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const user = require('./router/user');
const patient=require('./router/regpatient');
const appointment = require('./router/appointment');

const cookieParser = require('cookie-parser');

// ...existing code...
app.use(cookieParser());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://136.185.14.8:5555'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json())

app.use('/api/user', user);
app.use('/api/patient', patient);
app.use('/api/appointment', appointment);




const PORT = process.env.DB_PORT;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});