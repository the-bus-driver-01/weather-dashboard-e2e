// Weather Dashboard JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the dashboard
    initializeDashboard();
});

function initializeDashboard() {
    // Add smooth scroll behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    // Add hover effects for cards
    const weatherCards = document.querySelectorAll('.weather-card');
    weatherCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        });
    });

    // Add click event for forecast items
    const forecastItems = document.querySelectorAll('.forecast-item');
    forecastItems.forEach(item => {
        item.addEventListener('click', function() {
            // Add a subtle feedback animation
            this.style.transform = 'scale(1.02)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });

    // Add click event for stat items
    const statItems = document.querySelectorAll('.stat-item');
    statItems.forEach(item => {
        item.addEventListener('click', function() {
            // Add a subtle feedback animation
            this.style.transform = 'scale(1.02)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });

    // Simulate dynamic weather updates (for demo purposes)
    setInterval(() => {
        updateWeatherData();
    }, 30000); // Update every 30 seconds
}

function updateWeatherData() {
    // This would normally fetch data from a weather API
    // For now, we'll just add a subtle pulse animation to indicate updates
    const currentWeatherCard = document.querySelector('.current-weather');
    if (currentWeatherCard) {
        currentWeatherCard.style.animation = 'pulse 1s ease-in-out';
        setTimeout(() => {
            currentWeatherCard.style.animation = '';
        }, 1000);
    }
}

// Add CSS animation for pulse effect
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);