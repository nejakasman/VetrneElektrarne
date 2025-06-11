const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

module.exports = {
  packagerConfig: {
    asar: {
       unpack: '**/canvas/**',
    },
    icon: path.resolve(__dirname, 'src/assets/icon.icns'),  
  },
   hooks: {
    async afterExtract(config, buildPath, electronVersion, platform, arch) {
      const srcDir = path.resolve(__dirname, 'node_modules/canvas/build/Release');
      const destDir = path.join(buildPath, 'resources', 'app.asar.unpacked', 'node_modules', 'canvas', 'build', 'Release');

      if (fs.existsSync(srcDir)) {
        fs.mkdirSync(destDir, { recursive: true });
        for (const file of fs.readdirSync(srcDir)) {
          if (file.endsWith('.dylib')) {
            fs.copyFileSync(
              path.join(srcDir, file),
              path.join(destDir, file)
            );
            console.log(`Copied ${file} to ${destDir}`);
          }
        }
      } else {
        console.warn('Canvas build/Release mapa ni bila najdena.');
      }
    }
  },
  rebuildConfig: {},
  makers: [
    {
     name: '@electron-forge/maker-squirrel',
      config: {
        iconUrl: 'file://' + path.resolve(__dirname, 'src/assets/icon.icns'),
        setupIcon: path.resolve(__dirname, 'src/assets/icon.icns'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
      config: {
        icon: 'src/assets/icon.icns',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
