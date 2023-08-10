# ChromeSync
a chrome extension that provides open source synchronization of chrome browser data with an endpoint that you own.
## Development

### Client
1. make changes and build the client
```shell
npm run build:dev
```
2. open [chrome://extensions](chrome://extensions) and enable developer mode
3. select *Load Unpacked* and select the build output `ChromeSync/chrome-sync-client/build/`
4. the plugin can be opened from the extensions tray in chrome

### Service
1. make changes, build and start the service
```shell
export API_KEY=<API_KEY> && npm run build && node build/ChromeSyncService.js
```