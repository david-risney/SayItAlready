# Privacy

**Say It Already!** is a fully client-side web app. Your privacy is straightforward:

## Data Storage

All data stays on your device. The app uses:

- **localStorage** — settings (control mode, timer, sound), play history, favorites, and the "How to Play seen" flag
- **IndexedDB** — custom decks you create or import

Nothing is sent to a server.

## Network Requests

The app makes **no analytics, tracking, or telemetry calls**. The only network activity is:

- **Initial page load** — fetching the app files and built-in deck packs
- **Version check** — on the settings screen, a single fetch to the hosted `version.js` to see if an update is available
- **Service Worker caching** — precaches assets so the app works offline

## Third Parties

There are no third-party scripts, SDKs, cookies, or advertising.

## QR Code Sharing

When you generate a QR code for a deck, the deck data is compressed and encoded directly into the URL. No data is uploaded — the recipient's browser decodes it locally.

## Contact

If you have questions, open an issue on the [GitHub repository](https://github.com/david-risney/SayItAlready).
