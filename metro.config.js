const http = require('http');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { stripNodeColorConflict } = require('./scripts/lib/strip-node-color-conflict.cjs');

// Before WorkerFarm copies process.env into FORCE_COLOR=1 transform workers.
stripNodeColorConflict();


const apiRouteTestBlockList = /[\\/]app[\\/].*[\\/]__tests__[\\/].*\+api\.test\.ts$/;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
const previousGetTransformOptions = config.transformer?.getTransformOptions;

config.transformer = {
  ...(config.transformer ?? {}),
  getTransformOptions: async (args) => {
    const baseOptions = previousGetTransformOptions ? await previousGetTransformOptions(args) : {};
    return {
      ...baseOptions,
      transform: {
        ...(baseOptions.transform ?? {}),
        inlineRequires: true,
      },
    };
  },
};

// Expo null hybrid (Node crawl + Watchman watch). Requires
// scripts/patch-expo-metro-watchman.sh — without it, Expo coerces null→NativeWatcher
// and deep src/ edits stop applying while /status stays healthy.
//
// .watchmanconfig keeps node_modules ignored so Watchman does not flood FSEvents.
// The patch forces Node crawl so expo-router/entry still resolves.
config.resolver.useWatchman = null;

// i18n-iso-countries `main` → entry-node.js dynamically requires langs/*.json.
// Metro cannot map that context (and we only register `en`). Force browser entry.
const i18nIsoCountriesIndex = path.resolve(
  __dirname,
  'node_modules/i18n-iso-countries/index.js',
);
const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'i18n-iso-countries') {
    return { type: 'sourceFile', filePath: i18nIsoCountriesIndex };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  apiRouteTestBlockList,
  /[\\/]__tests__[\\/]/,
  /\.(test|spec)\.[jt]sx?$/,
];

config.watcher.healthCheck = {
  ...(config.watcher.healthCheck ?? {}),
  enabled: true,
  filePrefix: '.metro-health-check',
  interval: 15_000,
  timeout: 5_000,
};

// Best-effort Metro proxy → agent-ui daemon. Expo Router may still claim some
// paths; the app prefers http://<packager-host>:8191 directly (see http-bridge).
const AGENT_UI_PORT = Number(process.env.AGENT_UI_HTTP_PORT || 8191);
const previousEnhance = config.server?.enhanceMiddleware;
config.server = {
  ...(config.server ?? {}),
  enhanceMiddleware: (middleware, server) => {
    const base = previousEnhance
      ? previousEnhance(middleware, server)
      : middleware;
    return (req, res, next) => {
      const url = req.url || '';
      if (!url.startsWith('/__agent_ui')) {
        return base(req, res, next);
      }
      const parsed = new URL(url, 'http://127.0.0.1');
      const suffix = parsed.pathname.replace(/^\/__agent_ui/, '') || '/';
      const targetPath = `${suffix}${parsed.search}`;
      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: AGENT_UI_PORT,
          path: targetPath,
          method: req.method,
          headers: { ...req.headers, host: `127.0.0.1:${AGENT_UI_PORT}` },
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
          proxyRes.pipe(res);
        },
      );
      proxyReq.on('error', () => {
        if (!res.headersSent) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              ok: false,
              detail: 'agent-ui daemon down on :8191',
            }),
          );
        } else {
          res.end();
        }
      });
      req.pipe(proxyReq);
    };
  },
};

module.exports = config;
