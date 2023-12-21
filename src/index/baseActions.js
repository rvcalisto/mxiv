import { ActionDB } from "../app/actionDB.js"
import { Tab } from "../app/tabs.js"
import * as StatusBar from "../app/statusBar.js"
import * as Profiles from "../app/profiles.js"
import { AppCLI, cmdLineItem, standardFilter } from "../app/appCLI.js"
import * as Hotkeys from "../app/userHotkeys.js"
import { AppNotifier } from "../app/notifier.js"


/**
 * Commands that can be user invoked by shortcuts on keyHandler or AppCLI.
 */
ActionDB.setBaseActions({

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
            cmdLineItem('viewer', 'file navigator and general viewer (default)'), 
            cmdLineItem('library', 'collection of media directories and archives')
          ] : []
      },
      'move': {
        'desc' : 'move current tab to the right or left',
        'run'  : (right = 'right') => Tab.moveTab(right === 'right'),
        'options': () => [cmdLineItem('right', 'default'), 'left']
      },
      'cycle': {
        'desc' : 'cycle through tabs',
        'run'  : (next = 'next') => Tab.cycleTabs(next === 'next'),
        'options': () => [cmdLineItem('next', 'default'), 'back']
      },
      'close': {
        'desc' : 'close current tab',
        'run'  : () => Tab.selectedTab.close()
      },
      'duplicate': {
        'desc' : 'duplicate current tab',
        'run'  : () => Tab.duplicateTab()
      },
      'rename': {
        'desc' : 'rename current tab',
        'run'  : (newName) => {
          newName = newName.trim()
          if (newName) Tab.selectedTab.renameTab(newName)
        }
      },
      'visibility': {
        'desc' : 'toggle or set tab bar visibility',
        'run'  : (show) => {
          show = show === 'on' ? true : show === 'off' ? false : undefined
          Tab.toggleTabBar(show)
        },
        'options': () => [cmdLineItem('toggle', 'default'), 'on', 'off']
      }
    }
  },

  'profile': {
    'desc': 'store, load or erase profiles',
    'run' : () => {},

    'methods': {
      'load': {
        'desc': 'load session profile',
        'run': (name, clearSession = 'default') => Profiles.loadProfile(name, clearSession == 'default'),
        'options': (query, args) => {
          if (args.length === 1) return Profiles.listProfiles()
          if (args.length === 2) return [
            cmdLineItem('default', 'close current tabs on profile load'),
            cmdLineItem('keepSession', 'keep current tabs on profile load')
          ]
          return []
        }
      },
      'store': {
        'desc': 'store current session as profile',
        'run': (name) => Profiles.storeProfile(name),
        'options': (lastArg, allArgs) => {
          return allArgs.length === 1 ? Profiles.listProfiles() : []
        }
      },
      'erase': {
        'desc': 'erase a session profile',
        'run': (name) => Profiles.eraseProfile(name),
        'options': (lastArg, allArgs) => {
          return allArgs.length === 1 ? Profiles.listProfiles() : []
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
          Hotkeys.setUserKeys({ [keycombo]: args }, component)
          AppNotifier.notify(`user accelerator updated`)
        },
        'options': (lastArg, allArgs) => {
          if (allArgs.length > 3) return []
          if (allArgs.length > 2) return [
            cmdLineItem('default', 'revert accelerator to default'),
            cmdLineItem('mask', 'neutralize default action')
          ]
          if (allArgs.length < 2) return [
            cmdLineItem('base', 'on all components, but overruled on concurrency'),
            cmdLineItem('viewer', 'set/overwrite viewer accelerators'),
            cmdLineItem('library', 'set/overwrite library accelerators')
          ]

          const componentKeys = Hotkeys.getUserKeys(allArgs[0])
          const options = []

          for (const [keycombo, actionArg] of Object.entries(componentKeys) ) {
            let actionArgStr = actionArg.length ? '' : 'nothing'
            actionArg.forEach(chunk => actionArgStr += `"${chunk}" `)
            options.push( cmdLineItem(keycombo, actionArgStr) )
          }
          
          const coll = new Intl.Collator()
          return options.sort((a, b) => coll.compare(a.key, b.key))
        }
      },
      'reload': {
        'desc' : 'reload accelerators',
        'run'  : () => {
          Hotkeys.loadUserHotkeys()
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
          return ['apple', 'banana', cmdLineItem('coconut', 'has water inside')]
        }
      },
      'secondMethod': {
        'desc': 'no options in this method',
        'run': (args) => console.log('all args received:', ...args)
      }
    }
  },

})