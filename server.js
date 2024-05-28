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
        const hourlyReadings = {}; 

        for (let hour = 0; hour < 24; hour++) {
            hourlyReadings[hour] = {
                temp: [],
                humidity: [],
                aqi: [],
                dustConcentration: []
            };
        }

        lines.forEach(line => {
            const parts = line.split(' ');
            const readingDate = parts[0];
            const readingTime = parts[1];

            if (readingDate === date) {
                const hour = parseInt(readingTime.split(':')[0]); // Отримати годину з часу

                const temp = parseFloat(parts[2]);
                let humidity = parseFloat(parts[3]);
                let aqi = parseFloat(parts[4]);
                let dustConcentration = parseFloat(parts[5]);

                if (humidity < 0) humidity = 0;
                if (humidity > 100) humidity = 100;
                if (aqi < 0) aqi = 0;
                if (aqi > 500) aqi = 500;
                if (dustConcentration < 0) dustConcentration = 0;

                hourlyReadings[hour].temp.push(temp);
                hourlyReadings[hour].humidity.push(humidity);
                hourlyReadings[hour].aqi.push(aqi);
                hourlyReadings[hour].dustConcentration.push(dustConcentration);
            }
        });

        // Обчислення середніх значень за кожну годину
        const hourlyAverages = [];
        for (let hour = 0; hour < 24; hour++) {
            const readings = hourlyReadings[hour];
            const average = calculateHourlyAverage(readings);
            hourlyAverages.push({ datetime: `${date} ${hour}:00`, ...average });
        }

        res.json(hourlyAverages);
    });
});


function calculateHourlyAverage(readings) {
    const total = {
        temp: 0,
        humidity: 0,
        aqi: 0,
        dustConcentration: 0
    };

    readings.temp.forEach(temp => total.temp += temp);
    readings.humidity.forEach(humidity => total.humidity += humidity);
    readings.aqi.forEach(aqi => total.aqi += aqi);
    readings.dustConcentration.forEach(dustConcentration => total.dustConcentration += dustConcentration);

    const count = readings.temp.length;
    return {
        temp: (total.temp / count).toFixed(2),
        humidity: (total.humidity / count).toFixed(2),
        aqi: (total.aqi / count).toFixed(2),
        dustConcentration: (total.dustConcentration / count).toFixed(2)
    };
}


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
            const datetime = `${readingDate} ${parts[1]}`; // Зміна з "date" на "datetime"

            if (readingDate >= formattedStartDate && readingDate <= endDate) {
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

                if (!dailyReadings[readingDate]) {
                    dailyReadings[readingDate] = [];
                }

                dailyReadings[readingDate].push({ datetime, temp, humidity, aqi, dustConcentration, gasLeak }); // Зміна з "date" на "datetime"
            }
        });

        // Обчислення середніх значень за кожен день
        const dailyAverages = [];
        Object.keys(dailyReadings).forEach(readingDate => { // Зміна з "date" на "readingDate"
            const readings = dailyReadings[readingDate]; // Зміна з "date" на "readingDate"
            const average = calculateDailyAverage(readings);
            dailyAverages.push({ datetime: readingDate, ...average }); // Зміна з "date" на "datetime" тут та додано "...average"
        });

        res.json(dailyAverages);
    });
});

// Решта коду залишається без змін


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
        gasLeak: total.gasLeakCount > 0
    };
}


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
