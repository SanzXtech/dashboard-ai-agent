/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // Default bot URL — set via environment variable BOT_API_URL
    // or hardcode your Heroku URL here
    NEXT_PUBLIC_BOT_API_URL: process.env.BOT_API_URL || '',
    // API key matches global.token or global.dashboardApiKey in the bot's settings.js
    // Set this via environment variable BOT_API_KEY (e.g. in Vercel/Netlify dashboard)
    NEXT_PUBLIC_BOT_API_KEY: process.env.BOT_API_KEY || 'selfheal-dashboard',
  },
};

export default nextConfig;
