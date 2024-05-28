const fs = require('fs');
const express = require('express');
const app = express();
const port = 3000;

function isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateString);
}

function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Запит для отримання останніх вимірів
app.get('/last-reading', (req, res) => {
    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file');
        }

        const lines = data.trim().split('\n');
        const lastReading = lines[lines.length - 1].split(' ');

        const reading = {
            datetime: `${lastReading[0]} ${lastReading[1]}`,
            temp: parseFloat(lastReading[2]),
            humidity: parseFloat(lastReading[3]),
            aqi: parseFloat(lastReading[4]),
            dustConcentration: parseFloat(lastReading[5]),
            gasLeak: lastReading[6] === 'true'
        };

        res.json(reading);
    });
});


// Запит для отримання вимірів за день погодинно
app.get('/hourly-readings', (req, res) => {
    const { date } = req.query;
    if (!date || !isValidDate(date)) {
        return res.status(400).send('Invalid date format');
    }

    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file');
        }

        const lines = data.trim().split('\n');
        const hourlyReadings = []; 

        lines.forEach(line => {
            const parts = line.split(' ');
            const readingDate = parts[0];
            const readingTime = parts[1];

            if (readingDate === date) {
                const temp = parseFloat(parts[2]);
                let humidity = parseFloat(parts[3]);
                let aqi = parseFloat(parts[4]);
                let dustConcentration = parseFloat(parts[5]);

                if (humidity < 0) humidity = 0;
                if (humidity > 100) humidity = 100;
                if (aqi < 0) aqi = 0;
                if (aqi > 500) aqi = 500;
                if (dustConcentration < 0) dustConcentration = 0;

                hourlyReadings.push({ datetime: `${readingDate} ${readingTime}`, temp, humidity, aqi, dustConcentration });
            }
        });
        res.json(hourlyReadings);
    });
});

// Запит для отримання вимірів за останні кілька днів
app.get('/daily-averages', (req, res) => {
    const { days } = req.query;
    if (!days || isNaN(days) || days <= 0) {
        return res.status(400).send('Invalid days parameter');
    }

    const endDate = getCurrentDate();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1); // Останній день включається в розрахунок
    const formattedStartDate = formatDate(startDate);
    
    fs.readFile('data.txt', 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading file');
        }

        const lines = data.trim().split('\n');
        const dailyReadings = {};

        lines.forEach(line => {
            const parts = line.split(' ');
            const readingDate = parts[0];
            const date = readingDate.split('T')[0]; // Отримання дати без часу

            if (date >= formattedStartDate && date <= endDate) {
                const temp = parseFloat(parts[2]);
                let humidity = parseFloat(parts[3]);
                let aqi = parseFloat(parts[4]);
                let dustConcentration = parseFloat(parts[5]);
                const gasLeak = parts[6] === 'true';

                if (humidity < 0) humidity = 0;
                if (humidity > 100) humidity = 100;
                if (aqi < 0) aqi = 0;
                if (aqi > 500) aqi = 500;
                if (dustConcentration < 0) dustConcentration = 0;

                if (!dailyReadings[date]) {
                    dailyReadings[date] = [];
                }

                dailyReadings[date].push({ datetime: `${readingDate} ${parts[1]}`, temp, humidity, aqi, dustConcentration, gasLeak });
            }
        });

        // Обчислення середніх значень за кожен день
        const dailyAverages = [];
        Object.keys(dailyReadings).forEach(date => {
        const readings = dailyReadings[date];
        const average = calculateDailyAverage(readings);
        dailyAverages.push({ date, ...average });
});


        res.json(dailyAverages);
    });
});

function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function calculateDailyAverage(readings) {
    const total = {
        temp: 0,
        humidity: 0,
        aqi: 0,
        dustConcentration: 0,
        gasLeakCount: 0
    };

    readings.forEach(reading => {
        total.temp += reading.temp;
        total.humidity += reading.humidity;
        total.aqi += reading.aqi;
        total.dustConcentration += reading.dustConcentration;
        if (reading.gasLeak) {
            total.gasLeakCount++;
        }
    });

    const count = readings.length;
    return {
        temp: (total.temp / count).toFixed(2),
        humidity: (total.humidity / count).toFixed(2),
        aqi: (total.aqi / count).toFixed(2),
        dustConcentration: (total.dustConcentration / count).toFixed(2),
        gasLeak: ((total.gasLeakCount / count) * 100)
    };
}



app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
