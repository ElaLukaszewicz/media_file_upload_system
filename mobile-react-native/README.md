# Media Upload Mobile App

Minimal React Native mobile app configuration for the Media File Upload System.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. **Configure API Base URL** (Important for mobile devices):

   On mobile devices, `localhost` refers to the device itself, not your development machine. You need to use your computer's local IP address.

   **Find your local IP address:**
   - **macOS/Linux**: Run `ifconfig` or `ip addr` and look for your network interface (usually `en0` or `wlan0`)
   - **Windows**: Run `ipconfig` and look for IPv4 Address

   **Set the environment variable:**

   Create a `.env` file in the project root:

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:8000
   ```

   Example:

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
   ```

   **Or set it when starting Expo:**

   ```bash
   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000 npm start
   ```

3. Start the development server:

   ```bash
   npm start
   ```

4. Run on iOS:

   ```bash
   npm run ios
   ```

5. Run on Android:
   ```bash
   npm run android
   ```

## Troubleshooting

### Network Request Failed

If you see "Network request failed" errors:

1. **Check API server is running**: Make sure your backend server is running on the configured port (default: 8000)
2. **Use local IP address**: Don't use `localhost` or `127.0.0.1` - use your computer's local network IP
3. **Same network**: Ensure both your mobile device and development machine are on the same Wi-Fi network
4. **Firewall**: Check that your firewall allows incoming connections on port 8000
5. **Android Emulator**: If using Android emulator, you can use `10.0.2.2` instead of localhost

## Requirements

- Node.js 18+
- Expo CLI (install globally: `npm install -g expo-cli`)
- iOS Simulator (for iOS development on macOS)
- Android Studio / Android SDK (for Android development)

## Assets

Place the following assets in the `assets/` folder:

- `icon.png` - App icon (1024x1024)
- `splash.png` - Splash screen image
- `adaptive-icon.png` - Android adaptive icon (1024x1024)
- `favicon.png` - Web favicon
