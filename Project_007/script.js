const weatherData = {
  chennai: {
    name: "Chennai",
    temp: "32°C",
    condition: "Sunny",
    icon: "☀️",
    theme: "sunny"
  },
  mumbai: {
    name: "Mumbai",
    temp: "28°C",
    condition: "Cloudy",
    icon: "☁️",
    theme: "cloudy"
  },
  delhi: {
    name: "Delhi",
    temp: "26°C",
    condition: "Rainy",
    icon: "🌧️",
    theme: "rainy"
  },
  bangalore: {
    name: "Bangalore",
    temp: "22°C",
    condition: "Thunderstorm",
    icon: "⛈️",
    theme: "thunderstorm"
  },
};

const citySelect = document.getElementById("citySelect");
const cityName = document.getElementById("cityName");
const temp = document.getElementById("temp");
const condition = document.getElementById("condition");
const weatherIcon = document.getElementById("weatherIcon");
const effects = document.getElementById("weatherEffects");

function updateWeather(cityKey) {
  const data = weatherData[cityKey];

  // Update weather info
  cityName.textContent = data.name;
  temp.textContent = data.temp;
  condition.textContent = data.condition;
  weatherIcon.textContent = data.icon;

  // Set theme
  document.body.className = data.theme;

  // Clear previous effects
  effects.innerHTML = "";
  effects.className = "";

  // Add new effects
  if (data.theme === "sunny") {
    effects.classList.add("sun-rays");
  } else if (data.theme === "cloudy") {
    for (let i = 0; i < 3; i++) {
      const cloud = document.createElement("div");
      cloud.className = "cloud";
      cloud.style.top = `${10 + i * 25}%`;
      effects.appendChild(cloud);
    }
  } else if (data.theme === "rainy") {
    for (let i = 0; i < 50; i++) {
      const drop = document.createElement("div");
      drop.className = "raindrop";
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDelay = `${Math.random()}s`;
      effects.appendChild(drop);
    }
  } else if (data.theme === "thunderstorm") {
    effects.classList.add("flash");
    for (let i = 0; i < 50; i++) {
      const drop = document.createElement("div");
      drop.className = "raindrop";
      drop.style.left = `${Math.random() * 100}%`;
      drop.style.animationDelay = `${Math.random()}s`;
      effects.appendChild(drop);
    }
  }
}

// Load default
updateWeather("chennai");

// Handle city change
citySelect.addEventListener("change", () => {
  updateWeather(citySelect.value);
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
      .then(reg => console.log("Service Worker Registered"))
      .catch(err => console.log("Service Worker Failed:", err));
  });
}
