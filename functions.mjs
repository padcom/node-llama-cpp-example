import { defineChatSessionFunction } from "node-llama-cpp"

const FRUIT_PRICES = {
  apple: '$6',
  banana: '$4',
}

// this is how you do a tool call
export const functions = {
  getFruitPrice: defineChatSessionFunction({
    description: 'Get the price of a fruit',
    params: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
      },
    },
    async handler(params) {
      console.log('getFruitPrice()', params)
      const name = params.name.toLowerCase()
      if (Object.hasOwn(FRUIT_PRICES, name)) {
        return { name, price: FRUIT_PRICES[name] }
      } else {
        return `Unrecognized fruid "${params.name}"`
      }
    }
  }),
  getWeatherAt: defineChatSessionFunction({
   // curl "https://api.open-meteo.com/v1/forecast?latitude=50.94&longitude=18.69&current=temperature_2m"
   // {"latitude":50.94,"longitude":18.699999,"generationtime_ms":0.020623207092285156,"utc_offset_seconds":0,"timezone":"GMT","timezone_abbreviation":"GMT","elevation":226.0,"current_units":{"time":"iso8601","interval":"seconds","temperature_2m":"°C"},"current":{"time":"2025-06-05T09:15","interval":900,"temperature_2m":22.5}}
    description: 'Get weather at a specific location',
    params: {
      type: 'object',
      properties: {
        lat: {
          type: 'number',
        },
        long: {
          type: 'number',
        }
      },
    },
    async handler(params) {
      console.log('getWeatherAt()', params)
      const lat = params.lat, long = params.long
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${long}&current=temperature_2m`)
      if (response.ok) {
        console.log('Response is OK')
        const data = await response.json()
        console.log('data:', data)

        return `${data.current.temperature_2m}${data.current_units.temperature_2m}`
      } else {
        console.log('Error while retrieving weather data', response.statusText)

        return `Unable to retrieve temperature for ${lat} ${long}`
      }
    }
  })
}
