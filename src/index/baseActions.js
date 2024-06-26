import { ActionController } from "../actions/actionController.js"
import { Tab } from "../tabs/tab.js"
import { StatusBar } from "../components/statusBar.js"
import { SessionProfiles } from "../tabs/profiles.js"
import { AppCLI, option, standardFilter } from "../components/appCli/appCLI.js"
import { UserAccelerators } from "../actions/userAccelerators.js"
import { AppNotifier } from "../components/notifier.js"


/**
 * Commands that can be user invoked by shortcuts on keyHandler or AppCLI.
 */
ActionController.setBaseActions({

  'cli': {
    'desc': 'app command line interface methods',
    'run': () => {},

    'methods': {
      'show': {
        'desc' : 'open app\'s command line interface on optional string',
        'run'  : (customStr) => AppCLI.toggle(true, customStr)
      },
      'repeatLast': {
        'desc' : 'repeat last command',
        'run'  : () => AppCLI.redoCmd()
      },
      'clear' : {
        'desc' : 'clear command history',
        'run'  : () => AppCLI.clearCmdHistory()
      }
    }
  },

  'tab': {
    'desc': 'create, move, rename tabs and more',
    'run': () => {},

    'methods': {
      'new': {
        'desc' : 'create new tab',
        'run'  : (type = 'viewer') => Tab.newTab(type),
        'options': (lastArg, allArgs) => allArgs.length < 2 ? [
            option('viewer', 'file navigator and general viewer (default)'), 
            option('library', 'collection of media directories and archives')
          ] : []
      },
      'move': {
        'desc' : 'move current tab to the right or left',
        'run'  : (right = 'right') => Tab.selected.move(right === 'right'),
        'options': () => [option('right', 'default'), 'left']
      },
      'cycle': {
        'desc' : 'cycle through tabs',
        'run'  : (next = 'next') => Tab.cycleTabs(next === 'next'),
        'options': () => [option('next', 'default'), 'back']
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
        'options': () => [option('toggle', 'default'), 'on', 'off']
      }
    }
  },

  'profile': {
    'desc': 'store, load or erase profiles',
    'run' : () => {},

    'methods': {
      'load': {
        'desc': 'load session profile',
        'run': (name, clearSession = 'default') => SessionProfiles.load(name, clearSession == 'default'),
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
            option('viewer', 'set/overwrite viewer accelerators'),
            option('library', 'set/overwrite library accelerators')
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
      'reload': {
        'desc' : 'reload accelerators',
        'run'  : () => {
          UserAccelerators.reload()
          AppNotifier.notify('reloaded user keys')
        }
      },
    }
  },

  '.testAction': {
    'desc' : 'this is a test action',
    'run'  : (firstArg, ...args) => console.log(`first arg: ${firstArg} \nargs:`, ...args),
    'options': (lastArg, allArgs) => ['1', '2', '3', '4', '5'],

    'methods': {
      'firstMethod': {
        'desc': 'a method with options',
        'run': (...args) => console.log('all args received:', ...args),
        'options': (lastArg, allArgs) => {
          console.log('options receive\nlastArg:', lastArg,'\nallArgs:', allArgs)
          return ['apple', 'banana', option('coconut', 'has water inside')]
        }
      },
      'secondMethod': {
        'desc': 'no options in this method',
        'run': (args) => console.log('all args received:', ...args)
      }
    }
  },

})