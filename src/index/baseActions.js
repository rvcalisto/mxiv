import { actionService } from "../actions/actionService.js"
import { TAB, cycleTabs, newFileViewer, newTab } from "../tabs/tab.js"
import { statusBar } from "../components/statusBar.js"
import * as sessionProfiles from "../tabs/profiles.js"
import { actionPalette, option } from "../components/actionPalette/actionPalette.js"
import { userAccelerators } from "../actions/userAccelerators.js"
import { notify } from "../components/notifier.js"
import { isFrameType, frameDescriptors } from "../frames/frameRegistry.js"
import { userPreferences } from "../components/userPreferences.js"
import * as headerPanel from "../tabs/tabHeaderPanel.js"


actionService.setBaseActions({
  
  'palette': {
    'desc': 'action palette methods',
    'actions': {
      'show': {
        'desc': 'show action palette, optionally with a given string',
        'run': (customStr) => actionPalette.toggle(true, customStr)
      },
      'repeatLast': {
        'desc': 'repeat last executed action',
        'run': () => actionPalette.repeatAction()
      },
      'clear': {
        'desc': 'clear previously executed actions from history',
        'run': () => actionPalette.clearActionHistory()
      }
    }
  },

  'tab': {
    'desc': 'create, move, rename tabs and more',
    'actions': {
      'new': {
        'desc' : 'create new tab',
        'run'  : (type = 'viewer') => {
          if ( isFrameType(type) )
            type === 'viewer' ? newFileViewer() : newTab(type)
          else
            notify(`"${type}" is not a valid tab type`, 'newTab')
        },
        'options': (lastArg, allArgs) => {
          const frameDescs = frameDescriptors()
          return allArgs.length < 2 ?
            frameDescs.map( ([frame, desc]) => option(frame, desc) ) : []
        }
      },
      'move': {
        'desc' : 'move current tab to the right or left',
        'run'  : (next = 'right') => TAB.move(next !== 'left'),
        'options': (lastArg, args) => args.length < 2 ?
          [option('right', 'default'), 'left'] : []
      },
      'cycle': {
        'desc' : 'cycle through tabs',
        'run'  : (next = 'next') => cycleTabs(next !== 'back'),
        'options': (lastArg, args) => args.length < 2 ?
          [option('next', 'default'), 'back'] : []
      },
      'close': {
        'desc' : 'close current tab',
        'run'  : () => TAB.close()
      },
      'duplicate': {
        'desc' : 'duplicate current tab',
        'run'  : () => TAB.duplicate()
      },
      'rename': {
        'desc' : 'rename current tab',
        'run'  : (newName) => {
          newName = newName.trim()
          if (newName) TAB.rename(newName)
        }
      },
      'visibility': {
        'desc' : 'toggle or set tab header bar visibility',
        'run'  : (show) => {
          const value = show === 'on' ? true : show === 'off' ? false : undefined
          headerPanel.toggleVisibility(value)
        },
        'options': (lastArg, args) => args.length < 2 ?
          [option('toggle', 'default'), 'on', 'off'] : []
      }
    }
  },

  'profile': {
    'desc': 'store, load or erase profiles',
    'actions': {
      'load': {
        'desc': 'load session profile',
        'run': (name, clearSession = 'default') =>
          sessionProfiles.load(name, clearSession !== 'keepSession'),
        'options': (query, args) => {
          if (args.length === 1) return sessionProfiles.list()
          if (args.length === 2) return [
            option('default', 'close current tabs on profile load'),
            option('keepSession', 'keep current tabs on profile load')
          ]
          return []
        }
      },
      'store': {
        'desc': 'store current session as profile',
        'run': (name) => sessionProfiles.store(name),
        'options': (lastArg, allArgs) => {
          return allArgs.length === 1 ? sessionProfiles.list() : []
        }
      },
      'erase': {
        'desc': 'erase a session profile',
        'run': (name) => sessionProfiles.erase(name),
        'options': (lastArg, allArgs) => {
          return allArgs.length === 1 ? sessionProfiles.list() : []
        }
      }
    }
  },

  'statusVisibility': {
    'desc' : 'toggle status bar visibility',
    'run'  : () => statusBar.toggle()
  },

  'newWindow': {
    'desc' : 'open a new window instance',
    'run'  : () => elecAPI.newWindow()
  },

  'fullscreen': {
    'desc': 'toggle fullscreen',
    'run': () => elecAPI.toggleFullscreen()
  },

  'accel': {
    'desc': 'manage user accelerators',
    'actions': {
      'set': {
        'desc': 'accelerate action with a hotkey : <component> <key/combo> <action...>',
        'run': (component, keycombo, ...args) => {
          if (!component || !keycombo) return
          userAccelerators.set(component, { [keycombo]: args })
          notify(`user accelerator updated`)
        },
        'options': (lastArg, allArgs) => {
          if (allArgs.length > 3) return []
          
          // hint erasure and masking options
          if (allArgs.length > 2) return [
            option('default', 'revert accelerator to default'),
            option('mask', 'neutralize default action')
          ]

          // hint available components
          if (allArgs.length < 2) return [
            option('base', 'on all components, but overruled on concurrency'),
            ...frameDescriptors().map(([name, desc]) => 
              option(name, `set/overwrite ${name} accelerators`))
          ]

          // hint stored user accelerators for component
          const accelObject = userAccelerators.getAcceleratorSet(allArgs[0])
          const options = []

          for (const [keycombo, actionArg] of Object.entries(accelObject) ) {
            let actionArgStr = actionArg.length ? '' : 'nothing'
            actionArg.forEach(chunk => actionArgStr += `"${chunk}" `)
            options.push( option(keycombo, actionArgStr) )
          }
          
          const coll = new Intl.Collator()
          return options.sort( (a, b) => coll.compare(a.name, b.name) )
        }
      },
    }
  },
  
  'setTheme': {
    'desc': 'set application theme',
    'run': (theme, ..._args) => {
      if ( !['light', 'dark', 'system'].includes(theme) ) {
        const isLightTheme = matchMedia('(prefers-color-scheme: light)').matches;
        theme = isLightTheme ? 'dark' : 'light'; // toggle theme
      }
      
      elecAPI.setTheme(theme);
      notify(`set theme to "${theme}"`, 'setTheme');
      
      userPreferences.themeOverride = theme;
    },
    'options': (_, args) => args.length < 2 ? ['light', 'dark', 'system'] : []
  }
});
