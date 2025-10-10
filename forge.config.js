export default {
  packagerConfig: {
    icon: 'src/icons/mxiv'
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mxiv'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: [
        'darwin'
      ]
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          productName: 'MXIV',
          genericName: 'Media Explorer & Interactive Viewer',
          icon: 'src/icons/mxiv.png',
          categories: [
            'AudioVideo',
            'Audio',
            'Video',
            'Graphics'
          ],
          recommends: [
            '7zip',
            'imagemagick'
          ],
          mimeType: [
            'inode/directory'
          ]
        }
      }
    }
  ]
};
