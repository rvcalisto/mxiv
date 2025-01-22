import { ActionService } from "../actions/actionService.js"
import { Tab } from "../tabs/tab.js"
import { StatusBar } from "../components/statusBar.js"
import { SessionProfiles } from "../tabs/profiles.js"
import { actionPalette, option, standardFilter } from "../components/actionPalette/actionPalette.js"
import { UserAccelerators } from "../actions/userAccelerators.js"
import { AppNotifier } from "../components/notifier.js"
import { FrameRegistry } from "../frames/frameRegistry.js"


ActionService.setBaseActions({
  
  'palette': {
    'desc': 'action palette methods',
    'run': () => {},
    'methods': {
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
    'run': () => {},

    'methods': {
      'new': {
        'desc' : 'create new tab',
        'run'  : (type = 'viewer') => {
          const success = Tab.newTab(type)
          if (!success)
            AppNotifier.notify(`tab "${type}" does not exist`, 'newTab')
        },
        'options': (lastArg, allArgs) => {
          const frameDescs = FrameRegistry.getDescriptors()
          return allArgs.length < 2 ?
            frameDescs.map( ([frame, desc]) => option(frame, desc) ) : []
        }
      },
      'move': {
        'desc' : 'move current tab to the right or left',
        'run'  : (next = 'right') => Tab.selected.move(next !== 'left'),
        'options': (lastArg, args) => args.length < 2 ?
          [option('right', 'default'), 'left'] : []
      },
      'cycle': {
        'desc' : 'cycle through tabs',
        'run'  : (next = 'next') => Tab.cycleTabs(next !== 'back'),
        'options': (lastArg, args) => args.length < 2 ?
          [option('next', 'default'), 'back'] : []
      },
      'close': {
        'desc' : 'close current tab',
        'run'  : () => Tab.selected.close()
      },
      'duplicate': {
        'desc' : 'duplicate current tab',
        'run'  : () => Tab.selected.duplicate()
      },
      'rename': {
        'desc' : 'rename current tab',
        'run'  : (newName) => {
          newName = newName.trim()
          if (newName) Tab.selected.rename(newName)
        }
      },
      'visibility': {
        'desc' : 'toggle or set tab header bar visibility',
        'run'  : (show) => {
          const value = show === 'on' ? true : show === 'off' ? false : undefined
          Tab.toggleHeaderBar(value)
        },
        'options': (lastArg, args) => args.length < 2 ?
          [option('toggle', 'default'), 'on', 'off'] : []
      }
    }
  },

  'profile': {
    'desc': 'store, load or erase profiles',
    'run' : () => {},

    'methods': {
      'load': {
        'desc': 'load session profile',
        'run': (name, clearSession = 'default') =>
          SessionProfiles.load(name, clearSession !== 'keepSession'),
        'options': (query, args) => {
          if (args.length === 1) return SessionProfiles.list()
          if (args.length === 2) return [
            option('default', 'close current tabs on profile load'),
            option('keepSession', 'keep current tabs on profile load')
          ]
          return []
        }
      },
      'store': {
        'desc': 'store current session as profile',
        'run': (name) => SessionProfiles.store(name),
        'options': (lastArg, allArgs) => {
          return allArgs.length === 1 ? SessionProfiles.list() : []
        }
      },
      'erase': {
        'desc': 'erase a session profile',
        'run': (name) => SessionProfiles.erase(name),
        'options': (lastArg, allArgs) => {
          return allArgs.length === 1 ? SessionProfiles.list() : []
        }
      }
    }
  },

  'statusVisibility': {
    'desc' : 'toggle status bar visibility',
    'run'  : () => StatusBar.toggle()
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
    'run': () => {},
    'methods': {
      'set': {
        'desc': 'accelerate action with a hotkey : <component> <key/combo> <action...>',
        'run': (component, keycombo, ...args) => {
          if (!component || !keycombo) return
          UserAccelerators.set(component, { [keycombo]: args })
          AppNotifier.notify(`user accelerator updated`)
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
            ...FrameRegistry.getDescriptors()
              .map(([name, desc]) => option(name, `set/overwrite ${name} accelerators`)),
          ]

          // hint stored user accelerators for component
          const accelObject = UserAccelerators.getAcceleratorSet(allArgs[0])
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
  
  'toggleTheme': {
    'desc': 'set color theme',
    'run': (theme, ..._args) => {
      toggleDarkTheme(theme === 'dark' ? true : theme === 'light' ? false : undefined);
    },
    'options': (_, args) => args.length < 2 ? ['light', 'dark'] : []
  }
});

/**
 * Toggle or force dark theme.
 * TODO: persist changes to user preferences when ready.
 * @param {boolean} [toDark]
 */
export function toggleDarkTheme(toDark) {
  if (toDark == null)
    toDark = 'light' === document.documentElement.getAttribute('theme');

  document.documentElement.setAttribute('theme', toDark ? 'dark' : 'light');
}
