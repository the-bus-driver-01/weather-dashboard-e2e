/**
 * Parses raw 5-day forecast data into daily summaries
 * @param {Object} rawForecastData - The raw API response from OpenWeatherMap 5-day forecast
 * @returns {Array} Array of daily summary objects with date, high, low, and condition
 */
function parseForecastData(rawForecastData) {
    try {
        // Enhanced input validation
        validateInput(rawForecastData);

        // Group entries by date
        const groupedByDate = groupEntriesByDate(rawForecastData.list);
        console.log('Processing forecast data with', rawForecastData.list.length, 'entries');
        console.log('Grouped into', Object.keys(groupedByDate).length, 'days');

        // Process each day's data
        const dailySummaries = [];

        // Sort dates to ensure proper chronological order
        const sortedDates = Object.keys(groupedByDate).sort();

        for (const date of sortedDates) {
            const entries = groupedByDate[date];
            const summary = processDayEntries(date, entries);
            if (summary) {
                dailySummaries.push(summary);
            }
        }

        // Handle partial days - even if the last day has incomplete data, include it
        // This ensures we always process available data, even for incomplete final days
        console.log('Generated', dailySummaries.length, 'daily summaries');

        return dailySummaries;

    } catch (error) {
        console.error('Error processing forecast data:', error);
        throw new Error(`Failed to parse forecast data: ${error.message}`);
    }
}

/**
 * Validates the input forecast data structure
 * @param {Object} rawForecastData - The raw API response to validate
 * @throws {Error} If the data structure is invalid
 */
function validateInput(rawForecastData) {
    if (!rawForecastData) {
        throw new Error('Forecast data is required');
    }

    if (!rawForecastData.list || !Array.isArray(rawForecastData.list)) {
        throw new Error('Invalid forecast data: missing or invalid list property');
    }

    if (rawForecastData.list.length === 0) {
        throw new Error('Invalid forecast data: empty list');
    }

    // Validate that we have at least some entries with required fields
    const validEntries = rawForecastData.list.filter(entry =>
        entry.dt_txt && entry.main && entry.weather && entry.weather.length > 0
    );

    if (validEntries.length === 0) {
        throw new Error('Invalid forecast data: no valid entries with required fields (dt_txt, main, weather)');
    }

    console.log(`Validated input: ${validEntries.length}/${rawForecastData.list.length} valid entries`);
}

/**
 * Formats a date string for consistent display
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') {
        return 'Invalid Date';
    }

    try {
        const date = new Date(dateStr + 'T00:00:00Z');
        return date.toISOString().split('T')[0];
    } catch (error) {
        console.warn('Error formatting date:', dateStr, error);
        return dateStr;
    }
}

/**
 * Maps API weather conditions to user-friendly descriptions
 * @param {string} apiCondition - Weather condition from API
 * @returns {string} User-friendly condition description
 */
function mapWeatherCondition(apiCondition) {
    const conditionMap = {
        'Thunderstorm': 'Thunderstorm',
        'Drizzle': 'Drizzle',
        'Rain': 'Rain',
        'Snow': 'Snow',
        'Mist': 'Mist',
        'Smoke': 'Smoke',
        'Haze': 'Haze',
        'Dust': 'Dust',
        'Fog': 'Fog',
        'Sand': 'Sand',
        'Ash': 'Ash',
        'Squall': 'Squall',
        'Tornado': 'Tornado',
        'Clear': 'Clear',
        'Clouds': 'Cloudy'
    };

    return conditionMap[apiCondition] || apiCondition || 'Unknown';
}

/**
 * Processes all entries for a single day to create a summary
 * @param {string} date - The date string (YYYY-MM-DD)
 * @param {Array} entries - Array of forecast entries for this date
 * @returns {Object|null} Daily summary object or null if invalid
 */
function processDayEntries(date, entries) {
    if (!entries || entries.length === 0) {
        console.warn('No entries for date:', date);
        return null;
    }

    // Calculate temperature aggregations
    const temperatures = extractTemperatures(entries);
    if (temperatures.length === 0) {
        console.warn('No valid temperatures for date:', date);
        return null;
    }

    const high = Math.max(...temperatures);
    const low = Math.min(...temperatures);

    // Get dominant weather condition
    const rawCondition = getDominantWeatherCondition(entries);
    const condition = mapWeatherCondition(rawCondition);

    // Create daily summary object with proper structure
    const summary = {
        date: formatDateString(date),
        high: Math.round(high * 100) / 100, // Round to 2 decimal places
        low: Math.round(low * 100) / 100,   // Round to 2 decimal places
        condition: condition
    };

    // Log info about partial days (less than typical 8 three-hour entries per day)
    if (entries.length < 8) {
        console.log(`Partial day data for ${date}: ${entries.length} entries (${summary.condition})`);
    }

    return summary;
}

/**
 * Extracts temperature values from forecast entries
 * @param {Array} entries - Array of forecast entries
 * @returns {Array} Array of temperature values
 */
function extractTemperatures(entries) {
    const temperatures = [];

    entries.forEach(entry => {
        // Validate entry structure
        if (!entry.main) {
            console.warn('Entry missing main property:', entry);
            return;
        }

        // Try to get temperature from different fields
        let temp = null;
        if (entry.main.temp !== undefined) {
            temp = entry.main.temp;
        } else if (entry.main.temp_max !== undefined) {
            temp = entry.main.temp_max;
        } else if (entry.main.temp_min !== undefined) {
            temp = entry.main.temp_min;
        }

        if (temp !== null && !isNaN(temp)) {
            temperatures.push(temp);
        }
    });

    return temperatures;
}

/**
 * Groups forecast entries by date (YYYY-MM-DD format)
 * @param {Array} entries - Array of forecast entries from API
 * @returns {Object} Object with dates as keys and arrays of entries as values
 */
function groupEntriesByDate(entries) {
    const grouped = {};

    entries.forEach(entry => {
        // Validate entry structure
        if (!entry.dt_txt) {
            console.warn('Entry missing dt_txt field:', entry);
            return;
        }

        // Extract date from dt_txt (format: "2024-01-15 12:00:00")
        const dateStr = extractDateFromDtTxt(entry.dt_txt);

        if (!grouped[dateStr]) {
            grouped[dateStr] = [];
        }

        grouped[dateStr].push(entry);
    });

    return grouped;
}

/**
 * Extracts date in YYYY-MM-DD format from dt_txt string
 * @param {string} dtTxt - DateTime string from API (e.g., "2024-01-15 12:00:00")
 * @returns {string} Date string in YYYY-MM-DD format
 */
function extractDateFromDtTxt(dtTxt) {
    try {
        if (!dtTxt || typeof dtTxt !== 'string') {
            console.warn('Invalid dt_txt value:', dtTxt);
            return null;
        }

        // dt_txt format is "YYYY-MM-DD HH:MM:SS"
        const datePart = dtTxt.split(' ')[0];

        // Basic validation of date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            console.warn('Invalid date format in dt_txt:', dtTxt);
            return null;
        }

        return datePart;
    } catch (error) {
        console.error('Error extracting date from dt_txt:', dtTxt, error);
        return null;
    }
}

/**
 * Determines the dominant (most frequent) weather condition for a day
 * @param {Array} entries - Array of forecast entries for a single day
 * @returns {string} The most frequent weather condition, or 'Unknown' if none found
 */
function getDominantWeatherCondition(entries) {
    const conditionCounts = {};

    entries.forEach(entry => {
        // Validate entry structure
        if (!entry.weather || !Array.isArray(entry.weather) || entry.weather.length === 0) {
            console.warn('Entry missing weather data:', entry);
            return;
        }

        // Get the main weather condition (typically from the first weather object)
        const condition = entry.weather[0].main;
        if (condition) {
            conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
        }
    });

    // Find the most frequent condition
    let dominantCondition = 'Unknown';
    let maxCount = 0;

    for (const [condition, count] of Object.entries(conditionCounts)) {
        if (count > maxCount) {
            maxCount = count;
            dominantCondition = condition;
        }
    }

    // Handle tie-breaking with predefined priority order
    if (maxCount === 0) {
        return 'Unknown';
    }

    // If there are ties, prioritize certain conditions
    const priorityOrder = ['Thunderstorm', 'Rain', 'Snow', 'Drizzle', 'Clouds', 'Clear', 'Mist', 'Fog'];
    const tiedConditions = Object.entries(conditionCounts)
        .filter(([, count]) => count === maxCount)
        .map(([condition]) => condition);

    if (tiedConditions.length > 1) {
        // Return the highest priority condition among tied conditions
        for (const priority of priorityOrder) {
            if (tiedConditions.includes(priority)) {
                return priority;
            }
        }
    }

    return dominantCondition;
}

/**
 * Creates sample forecast data for testing purposes
 * @returns {Object} Sample forecast data structure
 */
function createSampleForecastData() {
    return {
        cod: "200",
        message: 0,
        cnt: 40,
        list: [
            // Day 1 entries
            {
                dt: 1640995200,
                main: { temp: 280.32, temp_min: 279.15, temp_max: 283.71 },
                weather: [{ id: 800, main: "Clear", description: "clear sky" }],
                dt_txt: "2024-01-01 12:00:00"
            },
            {
                dt: 1641006000,
                main: { temp: 275.22, temp_min: 273.15, temp_max: 277.71 },
                weather: [{ id: 800, main: "Clear", description: "clear sky" }],
                dt_txt: "2024-01-01 15:00:00"
            },
            {
                dt: 1641016800,
                main: { temp: 272.11, temp_min: 270.15, temp_max: 274.71 },
                weather: [{ id: 802, main: "Clouds", description: "scattered clouds" }],
                dt_txt: "2024-01-01 18:00:00"
            },
            // Day 2 entries (with rain)
            {
                dt: 1641081600,
                main: { temp: 278.32, temp_min: 276.15, temp_max: 281.71 },
                weather: [{ id: 500, main: "Rain", description: "light rain" }],
                dt_txt: "2024-01-02 12:00:00"
            },
            {
                dt: 1641092400,
                main: { temp: 280.22, temp_min: 278.15, temp_max: 283.71 },
                weather: [{ id: 500, main: "Rain", description: "light rain" }],
                dt_txt: "2024-01-02 15:00:00"
            }
            // Additional days would be included in real API response...
        ],
        city: {
            id: 2643743,
            name: "London",
            coord: { lat: 51.5085, lon: -0.1257 },
            country: "GB"
        }
    };
}

/**
 * Logs detailed information about the parsing process for debugging
 * @param {Object} rawForecastData - Raw forecast data
 * @param {Array} result - Parsed daily summaries
 */
function debugForecastParsing(rawForecastData, result) {
    console.log('\n=== Forecast Parsing Debug Info ===');
    console.log('Input entries:', rawForecastData.list?.length || 0);
    console.log('Output summaries:', result?.length || 0);

    if (result && result.length > 0) {
        console.log('\nDaily summaries:');
        result.forEach((summary, index) => {
            console.log(`  Day ${index + 1}: ${summary.date} | ${summary.condition} | H:${summary.high}° L:${summary.low}°`);
        });
    }

    // Show date range
    if (rawForecastData.list && rawForecastData.list.length > 0) {
        const firstEntry = rawForecastData.list[0];
        const lastEntry = rawForecastData.list[rawForecastData.list.length - 1];
        console.log(`\nDate range: ${firstEntry.dt_txt} to ${lastEntry.dt_txt}`);
    }

    console.log('=====================================\n');
}

/**
 * Validates that the parsed output meets expected criteria
 * @param {Array} dailySummaries - Array of daily summary objects
 * @throws {Error} If the output doesn't meet validation criteria
 */
function validateParsedOutput(dailySummaries) {
    if (!Array.isArray(dailySummaries)) {
        throw new Error('Output must be an array of daily summaries');
    }

    dailySummaries.forEach((summary, index) => {
        if (!summary.date || typeof summary.date !== 'string') {
            throw new Error(`Summary ${index}: Invalid date field`);
        }

        if (typeof summary.high !== 'number' || isNaN(summary.high)) {
            throw new Error(`Summary ${index}: Invalid high temperature`);
        }

        if (typeof summary.low !== 'number' || isNaN(summary.low)) {
            throw new Error(`Summary ${index}: Invalid low temperature`);
        }

        if (!summary.condition || typeof summary.condition !== 'string') {
            throw new Error(`Summary ${index}: Invalid condition field`);
        }

        if (summary.high < summary.low) {
            throw new Error(`Summary ${index}: High temperature cannot be lower than low temperature`);
        }
    });

    console.log('✓ Parsed output validation passed');
}

// Export the main function and utilities
module.exports = {
    parseForecastData,
    createSampleForecastData,
    debugForecastParsing,
    validateParsedOutput,

    // Export helper functions for testing
    validateInput,
    formatDateString,
    mapWeatherCondition
};