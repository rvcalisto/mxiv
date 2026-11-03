import { setComponentActions } from "../../actions/actionService.js";
import { option, setPaletteInfo, standardFilter } from "../../components/actionPalette/actionPalette.js";
import { runScript, tag, renameTags, deleteTags } from "../../components/fileMethods.js";


/**
 * @import { Viewer } from "./viewer.js"
 * @import { ActionSet } from "../../actions/componentActions.js"
 * @import { OnTrackEndMode } from "../../components/view/media.js"
 */


/**
 * @type {ActionSet<Viewer>}
 */
const viewerActions = {

  'open': {
    desc: 'open file(s) or folder(s)',
    run: (viewer, ...paths) => viewer.open(...paths),
    options: async (_viewer, query) => await elecAPI.queryPath(query),
    customFilter: () => () => true // filtered upstream, skip usual filter
  },

  'scrollTo': {
    desc: 'scroll to top or bottom of page',
    run: (viewer, arg = 'bottom') => viewer.viewComponent.scrollToEnd(arg === 'bottom'),
    options: (_viewer, _query, allArgs) => allArgs.length < 2
      ? ['top', option('bottom', 'default')]
      : []
  },

  'seek': {
    desc: 'seek or skip track to specified time',
    run: (viewer, time = '0') => viewer.viewComponent.media.seek(time),
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <[+|-][hh:mm:ss|number%]>');

      return [];
    }
  },

  'navigate': {
    desc: 'scroll, flip or seek content depending on type and context',
    actions: {
      'up': {
        desc: 'scroll up, otherwise skip track forward',
        run: (viewer, pixelDelta = '6', secsDelta = '60') => {
          viewer.viewComponent.navigate('y', Number(pixelDelta), Number(secsDelta))
        },
        options: (_viewer, _query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      },
      'down': {
        desc: 'scroll down, otherwise skip track backward',
        run: (viewer, pixelDelta = '6', secsDelta = '60') => {
          viewer.viewComponent.navigate('y', -Number(pixelDelta), -Number(secsDelta))
        },
        options: (_viewer, _query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      },
      'left': {
        desc: 'scroll left, go to previous image or skip track backward',
        run: (viewer, pixelDelta = '6', secsDelta = '5') => {
          viewer.viewComponent.navigate('x', -Number(pixelDelta), -Number(secsDelta))
        },
        options: (_viewer, _query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      },
      'right': {
        desc: 'scroll right, go to next image or skip track forward',
        run: (viewer, pixelDelta = '6', secsDelta = '5') => {
          viewer.viewComponent.navigate('x', Number(pixelDelta), Number(secsDelta))
        },
        options: (_viewer, _query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      }
    }
  },

  'viewFactor': {
    desc: 'change image size relative to view frame',
    actions: {
      'scale': {
        desc: 'scale image to fit view',
        run: (viewer) => viewer.viewComponent.screen.setViewMode('scale')
      },
      'width': {
        desc: 'scale image to fit view width',
        run: (viewer) => viewer.viewComponent.screen.setViewMode('width')
      },
      'height': {
        desc: 'scale image to fit view height',
        run: (viewer) => viewer.viewComponent.screen.setViewMode('height')
      },
      'stretch': {
        desc: 'stretch image to view',
        run: (viewer) => viewer.viewComponent.screen.setViewMode('stretch')
      },
      'none': {
        desc: 'show image in its native size',
        run: (viewer) => viewer.viewComponent.screen.setViewMode('none')
      },
      'cycle': {
        desc: 'cycle through factors in any direction',
        run: (viewer, next = 'next') => viewer.viewComponent.screen.cycleViewMode(next === 'next'),
        options: (_viewer, _query, allArgs) => allArgs.length < 2
          ? ['next', 'back']
          : []
      }
    }
  },

  'zoom': {
    desc: 'set zoom to value, prepend +/- to increment or decrement',
    run: (viewer, value = '100') => viewer.viewComponent.screen.zoom(value),
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <[+|-]zoom>');

      return [];
    }
  },

  'pause': {
    desc: 'toggle play/pause for audio/video',
    run: (viewer) => viewer.viewComponent.media.playToggle()
  },

  'flipPage': {
    desc: 'flip page forward or backwards',
    run: (viewer, next = 'next') => viewer.flipPage(next === 'next'),
    options: (_viewer, _query, allArgs) => allArgs.length < 2
      ? ['next', 'back']
      : []
  },

  'setVolume': {
    desc: 'increase, decrease or set new volume',
    run: (viewer, volume) => viewer.viewComponent.media.setVolume(volume),
    options: (_viewer, _query, args) => {
      if (args.length < 2)
        setPaletteInfo('arguments: <[+|-]volume>');

      return [];
    }
  },

  'mute': {
    desc: 'toggle mute for audio/video',
    run: (viewer) => viewer.viewComponent.media.muteToggle()
  },

  'reload': {
    desc: 'reload directory contents',
    run: (viewer) => viewer.reload()
  },

  'loop': {
    desc: 'set AB loop at track time',
    run: (viewer, aTime, bTime) => viewer.viewComponent.media.abLoop(aTime, bTime),
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length < 3)
        setPaletteInfo('arguments: [hh:mm:ss] [hh:mm:ss]');

      return [];
    }
  },

  'endRepeat': {
    desc: 'set media flow behavior on end of track',
    run: (viewer, option = 'cycle') => {
      viewer.viewComponent.media.onEndRepeat( /** @type {OnTrackEndMode} */ (option) )
    },
    options: (_viewer, _query, allArgs) => allArgs.length < 2 ? [
      option('cycle', 'cycle between modes (default)'),
      option('loop', 'play same track on repeat'),
      option('next', 'play next track in playlist'),
      option('random', 'play a random track in playlist')
    ] : []
  },

  'speed': {
    desc: 'change video playback rate, prepend +/- to increment or decrement',
    run: (viewer, speed = '1') => viewer.viewComponent.media.playbackRate(speed),
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <[+|-]speed>');

      return [];
    }
  },

  'preservePitch': {
    desc: 'preserve pitch when audio/video playback-rate is changed',
    run: (viewer, value = 'toggle') => {
      const options = /** @type {Object<string, boolean>}*/ ({ 'true': true, 'false': false });
      viewer.viewComponent.media.preservePitch(options[value]);
    },
    options: (_viewer, _query, allArgs) => allArgs.length < 2 ? [
      option('true', 'preserve pitch'),
      option('false', 'don\'t preserve pitch'),
      option('toggle', 'alternate option (default)')
    ] : []
  },

  'openFileDialog': {
    desc: 'open folder with dialog window',
    run: async (viewer) => {
      const paths = await elecAPI.dialog('open', {
        title: "Open Folder",
        properties: ['openDirectory'],
        buttonLabel: "Select Folder",
      });

      if (paths != null)
        viewer.open(...paths);
    }
  },

  'goto': {
    desc: 'go to page number',
    run: (viewer, value) => {
      const page = parseInt(value);

      !isNaN(page)
        ? viewer.gotoPage(page -1)
        : viewer.notify('invalid page number');
    },
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <number>');
      
      return [];
    }
  },

  'toggleFlipAnimation': {
    desc: 'set auto scroll animation after a page-flip on or off',
    run: (viewer, value = 'toggle') => {
      const options = /** @type {Object<string, boolean>}*/ ({ 'on': true, 'off': false });
      viewer.viewComponent.toggleAutoScrollAnimation(options[value]);
    },
    options: (_viewer, _query, allArgs) => allArgs.length < 2
      ? [option('toggle', 'default'), 'on', 'off']
      : []
  },

  'random': {
    desc: 'go to random page',
    run: (viewer) => viewer.gotoRandom()
  },

  'find': {
    desc: 'find next page with matching substrings',
    run: (viewer, ...queries) => viewer.find(...queries),
    options: (viewer) => viewer.fileBook.files.map(i => i.name)
  },

  'slideshow': {
    desc: 'slide through pages on a set delay',
    run: (viewer, option = 'toggle', delay = '1') => {
      if (option === 'delay')
        viewer.viewComponent.slideshow.delay = parseFloat(delay);
      else
        viewer.viewComponent.slideshow.toggle();
    },
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length === 2 && allArgs[0] === 'delay')
        setPaletteInfo('arguments: <seconds>');

      return allArgs.length < 2
        ? [
          option('toggle', 'toggle slideshow on or off (default)'),
          option('delay', 'set slideshow delay in seconds'),
        ] : [];
    }
  },

  'fileExplorer': {
    desc: 'alternate fileExplorer mode and focus',
    actions: {
      'mode': {
        desc: 'set mode or collapse/expand panel',
        run: (viewer, mode = 'toggle') => {
          if (mode === viewer.fileExplorer.mode)
            viewer.fileExplorer.togglePanel();
          else
            viewer.fileExplorer.toggleMode(/** @type {'explorer'|'playlist'} */ (mode));
        },
        options: (_viewer, _query, allArgs) => allArgs.length < 2 ? [
          option('toggle', 'alternate between modes (default)'), 
          option('explorer', 'navigate through directories'), 
          option('playlist', 'list currently loaded files')
        ] : []
      },
      'toggleFocus': {
        desc: 'toggle focus between View and FileExplorer',
        run: (viewer) => {
          const shadowRoot = /** @type {ShadowRoot} */ (viewer.shadowRoot);
          const focusPanel = shadowRoot.activeElement !== viewer.fileExplorer;

          focusPanel 
            ? viewer.fileExplorer.focus() 
            : viewer.fileExplorer.blur();
        }
      }
    }
  },

  'filter': {
    desc: 'filter files by name or tags, list tags with ?, prepend - to exclude it',
    run: (viewer, ...queries) => viewer.filter(...queries),
    options: (viewer, query) => {
      setPaletteInfo('arguments: [[-]string...], ?: list tags');

      return query[0] === '?'
        ? elecAPI.uniqueTags()
        : viewer.fileBook.files.map(i => i.name);
    },
    customFilter: (_viewer, query) => {
      if (query[0] === '?')
        query = query.slice(1);

      return standardFilter(query);
    }
  },

  'delete': {
    desc: 'permanently delete current file',
    run: async (viewer) => await viewer.deletePage()
  },

  'runScript': {
    desc: 'run user script where %F, %N, %T represent the selected file path, \
            name & type, respectively',
    run: async (viewer, script, msg) => {
      await runScript(script, viewer.fileBook.currentFile?.path, msg);
    },
    options: (_viewer, _query, allArgs) => {
      if (allArgs.length < 3)
        setPaletteInfo('arguments: <script, %F: filepath, %N: basename, %T: filetype> [notification]');

      return [];
    }
  },

  'tag': {
    desc: 'add or remove tags from current file',
    actions: {
      'add': {
        desc: 'add one or more tags to current file',
        run: async (viewer, ...tags) => {
          const currentFile = viewer.fileBook.currentFile;

          if (currentFile != null)
            await tag(currentFile.path, true, ...tags);
        },
        options: () => elecAPI.uniqueTags()
      },
      'del': {
        desc: 'delete one or more tags from current file',
        run: async (viewer, ...tags) => {
          const currentFile = viewer.fileBook.currentFile;

          if (currentFile != null)
            await tag(currentFile.path, false, ...tags);
        },
        options: (viewer) => {
          const currentFile = viewer.fileBook.currentFile;

          return currentFile != null
            ? elecAPI.getTags(currentFile.path)
            : [];
        }
      },
      'rename': {
        desc: 'rename all occurrences of one or more tags',
        run: async (_viewer, ...tags) => await renameTags(...tags),
        options: () => elecAPI.uniqueTags()
      },
      'purge': {
        desc: 'purge all occurrences of one or more tags',
        run: async (_viewer, ...tags) => await deleteTags(...tags),
        options: () => elecAPI.uniqueTags()
      }
    }
  }
};


setComponentActions('viewer', viewerActions);
