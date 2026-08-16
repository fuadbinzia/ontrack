module.exports = function (api) {
  // Jest's CJS runtime cannot evaluate native import() (no
  // --experimental-vm-modules), so rewrite dynamic import (e.g. the lazy xlsx
  // module) only there. Coverage instrumentation and Metro report
  // supportsDynamicImport and keep native import().
  const isTest = api.env('test');
  const nativeDynamicImport = api.caller(
    (caller) => Boolean(caller && caller.supportsDynamicImport),
  );
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isTest && !nativeDynamicImport
        ? ['@babel/plugin-transform-dynamic-import']
        : []),
      'react-native-reanimated/plugin',
    ],
  };
};
