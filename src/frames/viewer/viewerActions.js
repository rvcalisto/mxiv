import { setComponentActions } from "../../actions/actionService.js";
import { FRAME } from "../../tabs/tab.js";
import { option, setPaletteInfo, standardFilter } from "../../components/actionPalette/actionPalette.js";
import { runScript, tag, renameTags, deleteTags } from "../../components/fileMethods.js";


/**
 * @import { Viewer } from "./viewer.js"
 * @import { OnTrackEndMode } from "../../components/view/media.js"
 */


// [Workaround] get type check support for current FRAME.
const frame = () => /** @type {Viewer} */ (FRAME);


setComponentActions('viewer', {

  'open': {
    desc : 'open file(s) or folder(s)',
    run  : (...paths) => frame().open(...paths),
    options : async (query) => await elecAPI.queryPath(query),
    customFilter : () => () => true // filtered upstream, skip usual filter
  },

  'scrollTo': {
    desc : 'scroll to top or bottom of page',
    run  : (arg = 'bottom') => frame().viewComponent.scrollToEnd(arg === 'bottom'),
    options: (_query, allArgs) => allArgs.length < 2
      ? ['top', option('bottom', 'default')]
      : []
  },

  'seek': {
    desc: 'seek or skip track to specified time',
    run: (time = '0') => frame().viewComponent.media.seek(time),
    options: (_query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <[+|-][hh:mm:ss|number%]>');

      return [];
    }
  },

  'navigate': {
    desc: 'scroll, flip or seek content depending on type and context',
    actions: {
      'up': {
        desc : 'scroll up, otherwise skip track forward',
        run  : (pixelDelta = '6', secsDelta = '60') => {
          frame().viewComponent.navigate('y', Number(pixelDelta), Number(secsDelta))
        },
        options: (_query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      },
      'down': {
        desc : 'scroll down, otherwise skip track backward',
        run  : (pixelDelta = '6', secsDelta = '60') => {
          frame().viewComponent.navigate('y', -Number(pixelDelta), -Number(secsDelta))
        },
        options: (_query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      },
      'left': {
        desc : 'scroll left, go to previous image or skip track backward',
        run  : (pixelDelta = '6', secsDelta = '5') => {
          frame().viewComponent.navigate('x', -Number(pixelDelta), -Number(secsDelta))
        },
        options: (_query, allArgs) => {
          if (allArgs.length < 3)
            setPaletteInfo('arguments: [pixels] [seconds]');

          return [];
        }
      },
      'right': {
        desc : 'scroll right, go to next image or skip track forward',
        run  : (pixelDelta = '6', secsDelta = '5') => {
          frame().viewComponent.navigate('x', Number(pixelDelta), Number(secsDelta))
        },
        options: (_query, allArgs) => {
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
        run: () => frame().viewComponent.screen.setViewMode('scale')
      },
      'width': {
        desc: 'scale image to fit view width',
        run: () => frame().viewComponent.screen.setViewMode('width')
      },
      'height': {
        desc: 'scale image to fit view height',
        run: () => frame().viewComponent.screen.setViewMode('height')
      },
      'stretch': {
        desc: 'stretch image to view',
        run: () => frame().viewComponent.screen.setViewMode('stretch')
      },
      'none': {
        desc: 'show image in its native size',
        run: () => frame().viewComponent.screen.setViewMode('none')
      },
      'cycle': {
        desc: 'cycle through factors in any direction',
        run: (next = 'next') => frame().viewComponent.screen.cycleViewMode(next === 'next'),
        options: (_query, allArgs) => allArgs.length < 2
          ? ['next', 'back']
          : []
      }
    }
  },

  'zoom': {
    desc : 'set zoom to value, prepend +/- to increment or decrement',
    run  : (value = '100') => frame().viewComponent.screen.zoom(value),
    options: (_query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <[+|-]zoom>');

      return [];
    }
  },

  'pause': {
    desc : 'toggle play/pause for audio/video',
    run  : () => frame().viewComponent.media.playToggle()
  },

  'flipPage': {
    desc : 'flip page forward or backwards',
    run  : (next = 'next') => frame().flipPage(next === 'next'),
    options: (_query, allArgs) => allArgs.length < 2
      ? ['next', 'back']
      : []
  },

  'setVolume': {
    desc : 'increase, decrease or set new volume',
    run  : (volume) => frame().viewComponent.media.setVolume(volume),
    options: (_query, args) => {
      if (args.length < 2)
        setPaletteInfo('arguments: <[+|-]volume>');

      return [];
    }
  },

  'mute': {
    desc : 'toggle mute for audio/video',
    run  : () => frame().viewComponent.media.muteToggle()
  },

  'reload': {
    desc : 'reload directory contents',
    run  : () => frame().reload()
  },

  'loop': {
    desc : 'set AB loop at track time',
    run  : (aTime, bTime) => frame().viewComponent.media.abLoop(aTime, bTime),
    options: (_query, allArgs) => {
      if (allArgs.length < 3)
        setPaletteInfo('arguments: [hh:mm:ss] [hh:mm:ss]');

      return [];
    }
  },

  'endRepeat': {
    desc: 'set media flow behavior on end of track',
    run: (option = 'cycle') => {
      frame().viewComponent.media.onEndRepeat( /** @type {OnTrackEndMode} */ (option) )
    },
    options: (_query, allArgs) => allArgs.length < 2 ? [
      option('cycle', 'cycle between modes (default)'),
      option('loop', 'play same track on repeat'),
      option('next', 'play next track in playlist'),
      option('random', 'play a random track in playlist')
    ] : []
  },

  'speed': {
    desc : 'change video playback rate, prepend +/- to increment or decrement',
    run  : (speed = '1') => frame().viewComponent.media.playbackRate(speed),
    options: (_query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <[+|-]speed>');

      return [];
    }
  },

  'preservePitch': {
    desc: 'preserve pitch when audio/video playback-rate is changed',
    run: (value = 'toggle') => {
      const options = /** @type {Object<string, boolean>}*/ ({ 'true': true, 'false': false });
      frame().viewComponent.media.preservePitch(options[value]);
    },
    options: (_query, allArgs) => allArgs.length < 2 ? [
      option('true', 'preserve pitch'),
      option('false', 'don\'t preserve pitch'),
      option('toggle', 'alternate option (default)')
    ] : []
  },

  'openFileDialog': {
    desc : 'open folder with dialog window',
    run  : async () => {
      const paths = await elecAPI.dialog('open', {
        title: "Open Folder",
        properties: ['openDirectory'],
        buttonLabel: "Select Folder",
      });

      if (paths != null)
        frame().open(...paths);
    }
  },

  'goto': {
    desc : 'go to page number',
    run  : (value) => {
      const page = parseInt(value);

      !isNaN(page)
        ? frame().gotoPage(page -1)
        : frame().notify('invalid page number');
    },
    options: (_query, allArgs) => {
      if (allArgs.length < 2)
        setPaletteInfo('arguments: <number>');
      
      return [];
    }
  },

  'toggleFlipAnimation': {
    desc : 'set auto scroll animation after a page-flip on or off',
    run  : (value = 'toggle') => {
      const options = /** @type {Object<string, boolean>}*/ ({ 'on': true, 'off': false });
      frame().viewComponent.toggleAutoScrollAnimation(options[value]);
    },
    options: (_query, allArgs) => allArgs.length < 2
      ? [option('toggle', 'default'), 'on', 'off']
      : []
  },

  'random': {
    desc : 'go to random page',
    run  : () => frame().gotoRandom()
  },

  'find': {
    desc : 'find next page with matching substrings',
    run  : (...queries) => frame().find(...queries),
    options: () => frame().fileBook.files.map(i => i.name)
  },

  'slideshow': {
    desc : 'slide through pages on a set delay',
    run  : (option = 'toggle', delay = '1') => {
      if (option === 'delay')
        frame().viewComponent.slideshow.delay = parseFloat(delay);
      else
        frame().viewComponent.slideshow.toggle();
    },
    options: (_query, allArgs) => {
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
        run: (mode = 'toggle') => {
          if (mode === frame().fileExplorer.mode)
            frame().fileExplorer.togglePanel();
          else
            frame().fileExplorer.toggleMode(/** @type {'explorer'|'playlist'} */ (mode));
        },
        options: (_query, allArgs) => allArgs.length < 2 ? [
          option('toggle', 'alternate between modes (default)'), 
          option('explorer', 'navigate through directories'), 
          option('playlist', 'list currently loaded files')
        ] : []
      },
      'toggleFocus': {
        desc : 'toggle focus between View and FileExplorer',
        run  : () => {
          const shadowRoot = /** @type {ShadowRoot} */ (frame().shadowRoot);
          const focusPanel = shadowRoot.activeElement !== frame().fileExplorer;

          focusPanel 
            ? frame().fileExplorer.focus() 
            : frame().fileExplorer.blur();
        }
      }
    }
  },

  'filter': {
    desc : 'filter files by name or tags, list tags with ?, prepend - to exclude it',
    run  : (...queries) => frame().filter(...queries),
    options: (query) => {
      setPaletteInfo('arguments: [[-]string...], ?: list tags');

      return query[0] === '?'
        ? elecAPI.uniqueTags()
        : frame().fileBook.files.map(i => i.name);
    },
    customFilter: (query) => {
      if (query[0] === '?')
        query = query.slice(1);

      return standardFilter(query);
    }
  },

  'delete': {
    desc : 'permanently delete current file',
    run  : async () => await frame().deletePage()
  },

  'runScript': {
    desc : 'run user script where %F, %N, %T represent the selected file path, \
            name & type, respectively',
    run  : async (script, msg) => {
      await runScript(script, frame().fileBook.currentFile?.path, msg);
    },
    options: (_query, allArgs) => {
      if (allArgs.length < 3)
        setPaletteInfo('arguments: <script, %F: filepath, %N: basename, %T: filetype> [notification]');

      return [];
    }
  },

  'tag': {
    desc : 'add or remove tags from current file',
    actions: {
      'add': {
        desc: 'add one or more tags to current file',
        run: async (...tags) => {
          const currentFile = frame().fileBook.currentFile;

          if (currentFile != null)
            await tag(currentFile.path, true, ...tags);
        },
        options: () => elecAPI.uniqueTags()
      },
      'del': {
        desc: 'delete one or more tags from current file',
        run: async (...tags) => {
          const currentFile = frame().fileBook.currentFile;

          if (currentFile != null)
            await tag(currentFile.path, false, ...tags);
        },
        options: () => {
          const currentFile = frame().fileBook.currentFile;

          return currentFile != null
            ? elecAPI.getTags(currentFile.path)
            : [];
        }
      },
      'rename': {
        desc: 'rename all occurrences of one or more tags',
        run: async (...tags) => await renameTags(...tags),
        options: () => elecAPI.uniqueTags()
      },
      'purge': {
        desc: 'purge all occurrences of one or more tags',
        run: async (...tags) => await deleteTags(...tags),
        options: () => elecAPI.uniqueTags()
      }
    }
  }
});
