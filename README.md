# Weather Dashboard E2E

A responsive weather dashboard that displays current weather information including temperature, humidity, and wind speed.

## Features

- **City Name Display**: Shows the current city name with proper formatting
- **Temperature Display**: Displays temperature in Celsius with proper positive/negative formatting
- **Humidity Display**: Shows humidity as a percentage with proper formatting
- **Wind Speed Display**: Displays wind speed in km/h with proper formatting
- **Placeholder States**: Shows loading placeholders while data is being fetched
- **Auto-refresh**: Automatically updates weather data every 10 minutes
- **Manual Refresh**: Click refresh button to manually update data
- **Responsive Design**: Works on desktop and mobile devices
- **Error Handling**: Displays error messages if data cannot be loaded

## Usage

### Quick Start

1. Open `index.html` in a web browser
2. The dashboard will automatically load with placeholder states
3. Weather data will be displayed after loading completes
4. Use the refresh button to manually update data

### Development Server

If you have Python installed, you can run a local server:

```bash
npm start
# or
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Implementation Details

### Placeholder States
- Loading animations while fetching data
- Shimmer effect for text placeholders
- Proper fallback states for network errors

### Formatting
- Temperature: Shows + for positive values, - for negative values
- Humidity: Displayed as percentage (e.g., "65%")
- Wind Speed: Displayed with units (e.g., "15 km/h")
- City names are properly capitalized

### Technical Features
- Responsive CSS Grid/Flexbox layout
- Modern JavaScript ES6+ features
- Smooth animations and transitions
- Clean, modular code architecture

## Files Structure

- `index.html` - Main HTML structure
- `styles.css` - CSS styling and responsive design
- `script.js` - JavaScript functionality and weather logic
- `package.json` - Project configuration

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## API Integration

Currently uses mock data for demonstration. In production, integrate with:
- OpenWeatherMap API
- AccuWeather API
- Other weather service providers

Replace the `fetchWeatherData()` method in `script.js` with actual API calls.