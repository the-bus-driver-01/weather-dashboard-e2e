class WeatherDashboard {
    constructor() {
        this.elements = {
            cityName: document.getElementById('city-name'),
            temperature: document.getElementById('temperature'),
            humidity: document.getElementById('humidity'),
            windSpeed: document.getElementById('wind-speed'),
            refreshBtn: document.getElementById('refresh-btn'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            tempUnit: document.getElementById('temp-unit'),
            windUnit: document.getElementById('wind-unit')
        };

        // Configuration object for API and settings
        this.config = {
            apiKey: process.env.WEATHER_API_KEY || 'demo_key', // Use environment variable or fallback to demo
            defaultCity: 'Toronto'
        };

        // Unit preferences
        this.units = {
            temperature: 'celsius', // 'celsius' or 'fahrenheit'
            windSpeed: 'kmh' // 'kmh' or 'mph'
        };

        this.init();
    }

    init() {
        // Initialize with placeholder states
        this.showPlaceholderStates();

        // Load weather data
        setTimeout(() => {
            this.loadWeatherData();
        }, 1000); // Simulate loading delay

        // Add refresh button event listener
        this.elements.refreshBtn.addEventListener('click', () => {
            this.refreshWeatherData();
        });

        // Add unit toggle event listeners if elements exist
        if (this.elements.tempUnit) {
            this.elements.tempUnit.addEventListener('click', () => {
                this.toggleTemperatureUnit();
            });
        }

        if (this.elements.windUnit) {
            this.elements.windUnit.addEventListener('click', () => {
                this.toggleWindSpeedUnit();
            });
        }

        // Auto-refresh every 10 minutes
        setInterval(() => {
            this.loadWeatherData();
        }, 600000);

        // Initialize unit displays
        this.updateTemperatureUnitDisplay();
        this.updateWindSpeedUnitDisplay();
    }

    showPlaceholderStates() {
        this.elements.cityName.textContent = 'Loading city...';
        this.elements.cityName.classList.add('placeholder');

        this.elements.temperature.textContent = '--';
        this.elements.humidity.textContent = '--%';
        this.elements.windSpeed.textContent = `-- ${this.getWindSpeedUnit()}`;

        this.elements.temperature.classList.add('placeholder');
        this.elements.humidity.classList.add('placeholder');
        this.elements.windSpeed.classList.add('placeholder');
    }

    removePlaceholderStates() {
        this.elements.cityName.classList.remove('placeholder');
        this.elements.temperature.classList.remove('placeholder');
        this.elements.humidity.classList.remove('placeholder');
        this.elements.windSpeed.classList.remove('placeholder');
    }

    showLoading() {
        this.elements.loading.style.display = 'flex';
        this.elements.error.style.display = 'none';
    }

    hideLoading() {
        this.elements.loading.style.display = 'none';
    }

    showError() {
        this.elements.error.style.display = 'block';
        this.elements.loading.style.display = 'none';
    }

    async loadWeatherData() {
        try {
            // In a real implementation, this would call a weather API
            // For demo purposes, we'll simulate API data
            const weatherData = await this.fetchWeatherData();
            this.updateWeatherDisplay(weatherData);
            this.removePlaceholderStates();
        } catch (error) {
            console.error('Error loading weather data:', error);
            this.showError();
        }
    }

    async refreshWeatherData() {
        this.showLoading();
        try {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            const weatherData = await this.fetchWeatherData();
            this.updateWeatherDisplay(weatherData);
            this.removePlaceholderStates();
        } catch (error) {
            console.error('Error refreshing weather data:', error);
            this.showError();
        } finally {
            this.hideLoading();
        }
    }

    async fetchWeatherData() {
        // Simulate weather API response
        // In a real app, this would make an actual API call to services like OpenWeatherMap
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockData = {
                    city: this.getRandomCity(),
                    temperature: this.getRandomTemperature(),
                    humidity: this.getRandomHumidity(),
                    windSpeed: this.getRandomWindSpeed(),
                    timestamp: new Date()
                };
                resolve(mockData);
            }, 500);
        });
    }

    getRandomCity() {
        const cities = [
            'Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa',
            'New York', 'London', 'Paris', 'Tokyo', 'Sydney',
            'Berlin', 'Amsterdam', 'Barcelona', 'Rome', 'Copenhagen'
        ];
        return cities[Math.floor(Math.random() * cities.length)];
    }

    getRandomTemperature() {
        // Generate temperature between -20 and 35°C
        return Math.floor(Math.random() * 56) - 20;
    }

    getRandomHumidity() {
        // Generate humidity between 30% and 95%
        return Math.floor(Math.random() * 66) + 30;
    }

    getRandomWindSpeed() {
        // Generate wind speed between 0 and 50 km/h
        return Math.floor(Math.random() * 51);
    }

    updateWeatherDisplay(data) {
        // Store current weather data for unit conversions
        this.currentWeatherData = data;

        // Update city name
        this.elements.cityName.textContent = data.city;

        // Update temperature with proper formatting
        this.elements.temperature.textContent = this.formatTemperature(data.temperature);

        // Update humidity with proper formatting
        this.elements.humidity.textContent = this.formatHumidity(data.humidity);

        // Update wind speed with proper formatting
        this.elements.windSpeed.textContent = this.formatWindSpeed(data.windSpeed);

        // Update page title with current unit
        document.title = `Weather in ${data.city} - ${this.formatTemperature(data.temperature)}${this.getTemperatureUnit()}`;
    }

    formatTemperature(temp) {
        // Convert temperature based on current unit preference
        const convertedTemp = this.units.temperature === 'fahrenheit' ?
            this.celsiusToFahrenheit(temp) : temp;

        const roundedTemp = Math.round(convertedTemp);
        return roundedTemp > 0 ? `+${roundedTemp}` : `${roundedTemp}`;
    }

    formatHumidity(humidity) {
        // Format humidity as percentage
        return `${Math.round(humidity)}%`;
    }

    formatWindSpeed(speed) {
        // Convert wind speed based on current unit preference
        const convertedSpeed = this.units.windSpeed === 'mph' ?
            this.kmhToMph(speed) : speed;

        return `${Math.round(convertedSpeed)} ${this.getWindSpeedUnit()}`;
    }

    // Unit conversion methods
    celsiusToFahrenheit(celsius) {
        return (celsius * 9/5) + 32;
    }

    fahrenheitToCelsius(fahrenheit) {
        return (fahrenheit - 32) * 5/9;
    }

    kmhToMph(kmh) {
        return kmh * 0.621371;
    }

    mphToKmh(mph) {
        return mph / 0.621371;
    }

    // Unit getter methods
    getTemperatureUnit() {
        return this.units.temperature === 'fahrenheit' ? '°F' : '°C';
    }

    getWindSpeedUnit() {
        return this.units.windSpeed === 'mph' ? 'mph' : 'km/h';
    }

    // Unit toggle methods
    toggleTemperatureUnit() {
        this.units.temperature = this.units.temperature === 'celsius' ? 'fahrenheit' : 'celsius';
        this.updateTemperatureDisplay();
        this.updateTemperatureUnitDisplay();
    }

    toggleWindSpeedUnit() {
        this.units.windSpeed = this.units.windSpeed === 'kmh' ? 'mph' : 'kmh';
        this.updateWindSpeedDisplay();
        this.updateWindSpeedUnitDisplay();
    }

    // Update display methods for unit changes
    updateTemperatureDisplay() {
        if (this.currentWeatherData) {
            this.elements.temperature.textContent = this.formatTemperature(this.currentWeatherData.temperature);
            document.title = `Weather in ${this.currentWeatherData.city} - ${this.formatTemperature(this.currentWeatherData.temperature)}${this.getTemperatureUnit()}`;
        }
    }

    updateWindSpeedDisplay() {
        if (this.currentWeatherData) {
            this.elements.windSpeed.textContent = this.formatWindSpeed(this.currentWeatherData.windSpeed);
        }
    }

    updateTemperatureUnitDisplay() {
        if (this.elements.tempUnit) {
            this.elements.tempUnit.textContent = this.getTemperatureUnit();
        }
    }

    updateWindSpeedUnitDisplay() {
        if (this.elements.windUnit) {
            this.elements.windUnit.textContent = `(${this.getWindSpeedUnit()})`;
        }
    }

    // Method to get user's location (for real implementation)
    async getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                },
                {
                    timeout: 10000,
                    enableHighAccuracy: true
                }
            );
        });
    }
}

// Initialize the weather dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new WeatherDashboard();

    // Make dashboard available globally for debugging
    window.weatherDashboard = dashboard;

    // Development mode logging (only in development)
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('Weather Dashboard initialized successfully');
    }
});