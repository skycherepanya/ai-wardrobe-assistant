import type { WeatherContext } from './geminiService';

export async function fetchCurrentWeather(): Promise<WeatherContext> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(getFallbackWeather());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
          );
          if (!res.ok) {
            resolve(getFallbackWeather());
            return;
          }
          const data = await res.json();
          const temp = Math.round(data.current?.temperature_2m ?? 20);
          const code = data.current?.weather_code ?? 0;
          const condition = mapWeatherCode(code);
          resolve({
            temperatureCelsius: temp,
            condition,
            locationName: 'Current Location',
          });
        } catch {
          resolve(getFallbackWeather());
        }
      },
      () => {
        resolve(getFallbackWeather());
      },
      { timeout: 5000 }
    );
  });
}

function getFallbackWeather(): WeatherContext {
  return {
    temperatureCelsius: 18,
    condition: 'Mild & Clear',
    locationName: 'Local Area',
  };
}

function mapWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 55) return 'Drizzle';
  if (code <= 65) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Clear';
}
