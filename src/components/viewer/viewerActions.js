import { ActionDB } from "../../actions/actionDB.js"
import { FRAME } from "../../tabs/tab.js"
import { option, standardFilter } from "../../appCli/appCLI.js"
import { AppNotifier } from "../../app/notifier.js"


/**
 * Commands that can be user invoked by shortcuts on keyHandler or IndexCLI.
 */
ActionDB.setComponentActions('viewer', {

  'open': {
    'desc' : 'open file(s) or folder(s)',
    'run'  : (...paths) => FRAME.open(...paths),
    'options' : async (query) => await elecAPI.fileAPI.lsHint(query),
    'customFilter' : () => () => true // filtered upstream, skip usual filter
  },

  'scrollTo': {
    'desc' : 'scroll to top or bottom of page',
    'run'  : (arg = 'bottom') => FRAME.viewComponent.scrollToEnd(arg === 'bottom'),
    'options': () => ['top', option('bottom', 'default')]
  },

  'navigate': {
    'desc': 'scroll media by pixels if zoomed in, skip seconds if video, flip page otherwise',
    'run': () => {},

    'methods': {
      'up': {
        'desc' : 'up: <pixels?> <seconds?>',
        'run'  : (pixelDelta = 6, secsDelta = 60) => {
          FRAME.viewComponent.navigate('y', Number(pixelDelta), Number(secsDelta))
        }
      },
      'down': {
        'desc' : 'down: <pixels?> <seconds?>',
        'run'  : (pixelDelta = 6, secsDelta = 60) => {
          FRAME.viewComponent.navigate('y', -Number(pixelDelta), -Number(secsDelta))
        }
      },
      'left': {
        'desc' : 'left: <pixels?> <seconds?>',
        'run'  : (pixelDelta = 6, secsDelta = 5) => {
          FRAME.viewComponent.navigate('x', -Number(pixelDelta), -Number(secsDelta))
        }
      },
      'right': {
        'desc' : 'right: <pixels?> <seconds?>',
        'run'  : (pixelDelta = 6, secsDelta = 5) => {
          FRAME.viewComponent.navigate('x', Number(pixelDelta), Number(secsDelta))
        }
      }
    }
  },

  'viewFactor': {
    'desc': 'change image size relative to view frame',
    'run': () => {},
    'methods': {
      'scale': {
        'desc': 'scale image to fit view',
        'run': () => FRAME.viewComponent.screen.setViewMode('scale')
      },
      'width': {
        'desc': 'scale image to fit view width',
        'run': () => FRAME.viewComponent.screen.setViewMode('width')
      },
      'height': {
        'desc': 'scale image to fit view height',
        'run': () => FRAME.viewComponent.screen.setViewMode('height')
      },
      'stretch': {
        'desc': 'stretch image to view',
        'run': () => FRAME.viewComponent.screen.setViewMode('stretch')
      },
      'none': {
        'desc': 'show image in its native size',
        'run': () => FRAME.viewComponent.screen.setViewMode('none')
      },
      'cycle': {
        'desc': 'cycle through factors in any direction',
        'run': (next = 'next') => FRAME.viewComponent.screen.cycleViewMode(next === 'next'),
        'options': (lastArg, allArgs) => allArgs.length < 2 ? ['next', 'back'] : []
      }
    }
  },

  'fullscreen': {
    'desc' : 'toggle fullscreen',
    'run'  : () => FRAME.toggleFullscreen()
  },

  'zoom': {
    'desc' : 'set zoom to value, prepend +/- to increment or decrement',
    'run'  : (value = '100') => FRAME.viewComponent.screen.zoom(value)
  },

  'pause': {
    'desc' : 'toggle play/pause for audio/video',
    'run'  : () => FRAME.viewComponent.media.playToggle()
  },

  'flipPage': {
    'desc' : 'flip page forward or backwards',
    'run'  : (next = 'next') => FRAME.flipPage(next === 'next'),
    'options': () => ['next', 'back']
  },

  'setVolume': {
    'desc' : 'set new volume, prepend +/- to increment or decrement',
    'run'  : (volume) => FRAME.viewComponent.media.setVolume(volume)
  },

  'mute': {
    'desc' : 'toggle mute for audio/video',
    'run'  : () => FRAME.viewComponent.media.muteToggle()
  },

  'reload': {
    'desc' : 'reload directory contents',
    'run'  : () => FRAME.reload()
  },

  'loop': {
    'desc' : 'AB loop audio/video',
    'run'  : () => FRAME.viewComponent.media.abLoop()
  },

  'endRepeat': {
    'desc': 'set media flow behavior on end of track',
    'run': (option = 'cycle') => {
      FRAME.viewComponent.media.onEndRepeat(option)
    },
    'options': (lastArg, allArgs) => allArgs.length < 2 ? [
      option('cycle', 'cycle between modes (default)'),
      option('loop', 'play same track on repeat'),
      option('next', 'play next track in playlist'),
      option('random', 'play a random track in playlist')
    ] : []
  },

  'speed': {
    'desc' : 'change video playback rate, prepend +/- to increment or decrement',
    'run'  : (speed = '1') => {
      FRAME.viewComponent.media.playbackRate(speed)
    } 
  },

  'preservePitch': {
    'desc': 'preserve pitch when audio/video playback-rate is changed',
    'run': (option = 'toggle') => {
      option = option === 'toggle' ? null : option === 'true'
      FRAME.viewComponent.media.preservePitch(option)
    },
    'options': (lastArg, allArgs) => allArgs.length < 2 ? [
      option('true', 'preserve pitch'),
      option('false', 'don\'t preserve pitch'),
      option('toggle', 'alternate option (default)')
    ] : []
  },

  'openFileDialog': {
    'desc' : 'open folder with dialog window',
    'run'  : async () => {
      const paths = await elecAPI.dialog({
        title: "Open Folder",
        properties: ['openDirectory'],
        buttonLabel: "Select Folder",
      })
      if (paths) FRAME.open(...paths)
    }
  },

  'goto': {
    'desc' : 'go to page number',
    'run'  : (arg) => {
      const page = parseInt(arg)
      FRAME.gotoPage(page -1)
    }
  },

  'toggleFlipAnimation': {
    'desc' : 'set auto scroll animation after a page-flip on or off',
    'run'  : (opt = 'toggle') => {
      opt = opt === 'on' ? true : opt === 'off' ? false : undefined
      FRAME.viewComponent.toggleAutoScrollAnimation(opt)
    },
    'options': () => [option('toggle', 'default'), 'on', 'off']
  },

  'random': {
    'desc' : 'go to random page',
    'run'  : () => FRAME.gotoRandom()
  },

  'find': {
    'desc' : 'find next page with matching substring',
    'run'  : (...queries) => FRAME.find(...queries),
    'options': () => FRAME.fileBook.files.map(i => i.name)
  },

  'slideshow': {
    'desc' : 'slide through pages on a set delay',
    'run'  : (option = 'toggle', delay = 1) => {
      if (option === 'delay') FRAME.viewComponent.slideshow.delay = parseFloat(delay)
      else FRAME.viewComponent.slideshow.toggle()
    },
    'options': (lastArg, allArgs) => allArgs.length < 2 ? [
      option('toggle', 'toggle slideshow on or off (default)'),
      option('delay', 'set slideshow delay in seconds'),
    ] : []
  },

  'fileExplorer': {
    'desc': 'alternate fileExplorer mode and focus',
    'run': () => {},
    'methods': {
      'mode': {
        'desc': 'set mode or collapse/expand panel',
        'run': (mode = 'toggle') => {
          if (mode === 'playlist') FRAME.fileExplorer.toggleMode('playlist')
          else if (mode === 'explorer') FRAME.fileExplorer.toggleMode('explorer')
          else FRAME.fileExplorer.toggleMode()
        },
        'options': (lastArg, allArgs) => allArgs.length < 2 ? [
          option('toggle', 'alternate between modes (default)'), 
          option('explorer', 'navigate through directories'), 
          option('playlist', 'list currently loaded files')
        ] : []
      },
      'toggleFocus': {
        'desc' : 'toggle focus between View and FileExplorer',
        'run'  : () => {
          const focusPanel = FRAME.shadowRoot.activeElement !== FRAME.fileExplorer
          focusPanel ? FRAME.fileExplorer.focus() : FRAME.fileExplorer.blur()
        }
      }
    }
  },

  'filter': {
    'desc' : 'filter files by name or tag, pass --exclusive to require a match for every string',
    'run'  : (...queries) => FRAME.filter(...queries),
    'options': (query) => {
      if (query.slice(0, 4) == 'tag:') return elecAPI.tagAPI.uniqueTags()
      else if (query.slice(0, 2) == '--') return [option('--exclusive', 'files must match every tag')]
      else return FRAME.fileBook.files.map(i => i.name)
    },
    'customFilter': (query) => {
      if (query.slice(0, 4) == 'tag:') query = query.slice(4)
      return standardFilter(query)
    }
  },

  'delete': {
    'desc' : 'permanently delete current file',
    'run'  : () => FRAME.deletePage()
  },

  'runScript': {
    'desc' : 'run user script where %F, %N represent current filepath & \
    filename respectively : <script> <displayMsg?>',
    'run'  : (usrCmd, optMsg) => {
      const msgId = 'runScript'
      if (!usrCmd) return AppNotifier.notify('invalid arguments', msgId)
      
      const wasRan = FRAME.runOnPage(usrCmd, optMsg, msgId)

      if (wasRan && optMsg) AppNotifier.notify(optMsg, msgId)
      else if (!wasRan) AppNotifier.notify(`this command needs a file to run`, msgId)
    }
  },

  'tag': {
    'desc' : 'add or remove tags from current file',
    'run'  : (action, ...tags) => {},

    'methods': {
      'add': {
        'desc': 'add one or more tags to current file',
        'run': async (...tags) => {
          const success = await FRAME.fileBook.tag(true, ...tags)
          AppNotifier.notify(`${success ? '' : 'no '}tags updated`)
        },
        'options': () => elecAPI.tagAPI.uniqueTags()
      },
      'del': {
        'desc': 'delete one or more tags from current file',
        'run': async (...tags) => {
          const success = await FRAME.fileBook.tag(false, ...tags)
          AppNotifier.notify(`${success ? '' : 'no '}tags updated`)
        },
        'options': () => {
          if (!FRAME.fileBook.currentFile) return []
          return elecAPI.tagAPI.getTags(FRAME.fileBook.currentFile.path)
        }
      }
    }
  },

})