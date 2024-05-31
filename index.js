const axios = require('axios');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const express = require('express');
const cron = require('node-cron');


const serviceAccount = require('./service-account-key.json');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//Burdaki değeri mongoya üye olduktan sonra ordaki değerle değiştirilecek.
const MONGODB_URI = 'mongodb+srv://tahirakbas34:zUaHeBT6XiVd2X8m@cluster0.iqxoaht.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log('Error connecting to MongoDB:', err);
});

// Define a schema and model for storing user data
const userSchema = new mongoose.Schema({
  location: String,
  token: String,
  date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

const app = express();
const PORT = process.env.PORT || 3000;
const WEATHER_API_URL = 'https://weatherapi-com.p.rapidapi.com/forecast.json';
const RAPIDAPI_KEY = 'd1798b759amsh96ec52ef8ad2a51p1b31c7jsn18e63785bd6d';
const RAPIDAPI_HOST = 'weatherapi-com.p.rapidapi.com';

app.use(bodyParser.json());

app.post('/send-notification', async (req, res) => {
  const { city, token } = req.body;
  
  if (!city || !token) {
    return res.status(400).send({ 'msg': 'City and token are required' });
  }

  try {
    // Fetch weather data using Axios
    const forecastResponse = await axios.get(WEATHER_API_URL, {
      params: {
        q: city,
        days: '3',
        lang: 'TR'
      },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });

    const weatherData = forecastResponse.data;
    let advise = "";
    if (weatherData.current.condition.text === "Açık") {
      advise = "Normal Giyindiğin gibi giyinip dışarı çıkabilirsin.";
    }
    if (weatherData.current.condition.text === "Yağmurlu") {
      advise = "Şemsiye ve Mont giyebilirsin.";
    }
    const message = {
      notification: {
        title: `Hava Durumu Güncellemesi ${city}`,
        body: `Hava Durumu: ${weatherData.current.temp_c}°C, ${weatherData.current.condition.text} ${advise}`
      },
      token: token
    };

    
    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);

   
    res.status(200).send({ 'message': 'Notification sent successfully' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send({ 'message': 'Error sending notification' });
  }
});


app.post('/setUserCurrentLocation', async (req, res) => {
  const { location, token } = req.body;

  if (!location || !token) {
    return res.status(400).send({ 'msg': 'Konum ve Token alanını boş bırakamazsın' });
  }
  
  try {
    
    const existingUser = await User.findOne({ token: token });
    if (existingUser) {
      return res.status(400).send({ 'msg': 'Token sistemde kayıtlı' });
    }

    
    const newUser = new User({
      location: location,
      token: token,
    });

    await newUser.save();
    res.status(200).send({ 'message': 'Başarılı bir şekilde kayıt edildi.' });
  } catch (error) {
    console.error('Error saving user data:', error);
    res.status(500).send({ 'message': 'Error saving user data' });
  }
});


//Bildirim göndermek istediğin saati (Dakika, Saat) formatında gönder örneğin ('20 8 * * *') anlamı
//Her gün saat 08.20 de bildirim gönder demek oluyor şu anda.
cron.schedule('22 21 * * *', async () => {

  try {
    const users = await User.find({});
    users.forEach(async (user) => {
      
      
      const forecastResponse = await axios.get(WEATHER_API_URL, {
        params: {
          q: user.location,
          days: '3',
          lang: 'TR'
        },
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST
        }
      });

      const weatherData = forecastResponse.data;
      let advise = "";
      if (weatherData.current.condition.text === "Açık") {
        advise = "Normal Giyindiğin gibi giyinip dışarı çıkabilirsin.";
      }
      if (weatherData.current.condition.text === "Yağmurlu") {
        advise = "Şemsiye ve Mont giyebilirsin.";
      }
      const message = {
        notification: {
          title: `Hava Durumu Güncellemesi ${user.location}`,
          body: `Hava Durumu: ${weatherData.current.temp_c}°C, ${weatherData.current.condition.text} ${advise}`
        },
        token: user.token
      };
      
      console.log(message)
      
      await admin.messaging().send(message);
      console.log(`Successfully sent message to ${user.token}`);
    });
  } catch (error) {
    console.error('Error sending scheduled notifications:', error);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
