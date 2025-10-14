import { setBaseActions } from "../actions/actionService.js";
import { TAB, cycleTabs, newFileViewer, newTab } from "../tabs/tab.js";
import { toggleStatus } from "../components/statusBar.js";
import * as sessionProfiles from "../tabs/profiles.js";
import palette, { option } from "../components/actionPalette/actionPalette.js";
import { getUserAccelerators, setUserAccelerators } from "../actions/userAccelerators.js";
import { notify } from "../components/notifier.js";
import { isFrameType, frameDescriptors } from "../frames/frameRegistry.js";
import userPreferences from "../components/userPreferences.js";
import * as headerPanel from "../tabs/tabHeaderPanel.js";


setBaseActions({

  'palette': {
    desc: 'open on action, repeat or clear recent actions from history',
    actions: {
      'show': {
        desc: 'show action palette, optionally with a given string',
        run: (customStr) => palette.togglePalette(true, customStr)
      },
      'repeatLast': {
        desc: 'repeat last executed action',
        run: () => palette.repeatLastAction()
      },
      'clear': {
        desc: 'clear previously executed actions from history',
        run: () => palette.clearActionHistory()
      }
    }
  },

  'tab': {
    desc: 'create, move, rename tabs and more',
    actions: {
      'new': {
        desc : 'create new tab',
        run  : (type = 'viewer') => {
          isFrameType(type)
            ? type === 'viewer' ? newFileViewer() : newTab(type)
            : notify(`"${type}" is not a valid tab type`, 'newTab');
        },
        options: (_query, allArgs) => allArgs.length < 2
          ? frameDescriptors().map( ([frame, desc]) => option(frame, desc) )
          : []
      },
      'move': {
        desc : 'move current tab to the right or left',
        run  : (next = 'right') => TAB?.move(next !== 'left'),
        options: (_query, args) => args.length < 2
          ? [option('right', 'default'), 'left']
          : []
      },
      'cycle': {
        desc : 'cycle through tabs',
        run  : (next = 'next') => cycleTabs(next !== 'back'),
        options: (_query, args) => args.length < 2
          ? [option('next', 'default'), 'back']
          : []
      },
      'close': {
        desc : 'close current tab',
        run  : () => TAB?.close()
      },
      'duplicate': {
        desc : 'duplicate current tab',
        run  : () => TAB?.duplicate()
      },
      'rename': {
        desc : 'rename current tab',
        run  : (name = '') => {
          const validName = name.trim();

          validName != ''
            ? TAB?.rename(validName)
            : notify('tab name can\'t be empty', 'tabRename');
        }
      },
      'visibility': {
        desc : 'toggle or set tab header bar visibility',
        run  : (value) => {
          const options = { on: true, off: false };
          headerPanel.toggleVisibility(options[value]);
        },
        options: (_query, args) => args.length < 2
          ? [option('toggle', 'default'), 'on', 'off']
          : []
      }
    }
  },

  'profile': {
    desc: 'store, load or erase session profiles',
    actions: {
      'load': {
        desc: 'load session profile',
        run: (name = '', clearSession = 'default') => {
          const treatedName = name.trim();

          treatedName !== ''
            ? sessionProfiles.load(treatedName, clearSession !== 'keepSession')
            : notify('session name can\'t be empty', 'proLoad');
        },
        options: (_query, args) => args.length > 2
          ? []
          : args.length < 2
            ? sessionProfiles.list()
            : [
                option('default', 'close current tabs on profile load'),
                option('keepSession', 'keep current tabs on profile load')
              ]
      },
      'store': {
        desc: 'store current session as profile',
        run: (name = '') => {
          const treatedName = name.trim();

          treatedName !== ''
            ? sessionProfiles.store(treatedName)
            : notify('session name can\'t be empty', 'proStore');
        },
        options: (_query, allArgs) => allArgs.length < 2
          ? sessionProfiles.list()
          : []
      },
      'erase': {
        desc: 'erase a session profile',
        run: (name = '') => {
          const treatedName = name.trim();

          treatedName !== ''
            ? sessionProfiles.erase(treatedName)
            : notify('session name can\'t be empty', 'proErase');
        },
        options: (_query, allArgs) => allArgs.length < 2
          ? sessionProfiles.list()
          : []
      }
    }
  },

  'statusVisibility': {
    desc : 'toggle status bar visibility',
    run  : () => toggleStatus()
  },

  'newWindow': {
    desc : 'open a new window instance',
    run  : () => elecAPI.newWindow()
  },

  'fullscreen': {
    desc: 'toggle fullscreen',
    run: () => elecAPI.toggleFullscreen()
  },

  'accel': {
    desc: 'manage user accelerators',
    actions: {
      'set': {
        desc: 'accelerate action with a hotkey : <component> <key/combo> <action...>',
        run: (component = '', keycombo = '', ...args) => {
          if ( !isFrameType(component) && component !== 'base' )
            notify(`${component} is not a valid component`);
          else if (keycombo === '')
            notify('hotkey can\'t be empty');
          else if ( args.filter( i => i.trim() ).length < 1 )
            notify('action can\'t be empty');
          else {
            setUserAccelerators(component, { [keycombo]: args });
            notify(`user accelerator updated`);
          }
        },
        options: (_query, allArgs) => {
          if (allArgs.length > 3)
            return [];

          // hint erasure and masking options
          if (allArgs.length > 2)
            return [
              option('default', 'revert accelerator to default'),
              option('mask', 'neutralize default action')
            ];

          // hint available components
          if (allArgs.length < 2)
            return [
              option('base', 'on all components, but overruled on concurrency'),
              ...frameDescriptors().map( ([name, _desc]) => 
                option(name, `set/overwrite ${name} accelerators`))
            ];

          // hint stored user accelerators for component
          const accelObject = getUserAccelerators(allArgs[0]);
          const options = [];

          for ( const [keycombo, actionArg] of Object.entries(accelObject) ) {
            let actionArgStr = actionArg.length > 0 ? '' : 'nothing';

            actionArg.forEach(chunk => actionArgStr += `"${chunk}" `);
            options.push( option(keycombo, actionArgStr) );
          }

          const coll = new Intl.Collator();
          return options.sort( (a, b) => coll.compare(a.name, b.name) );
        }
      },
    }
  },

  'preferences': {
    desc: 'set user preferences',
    actions: {
      'theme': {
        desc: 'set application theme',
        run: (theme = 'system', ..._args) => {
          // toggle theme if argument unknown
          if ( !['light', 'dark', 'system'].includes(theme) ) {
            const isLightTheme = matchMedia('(prefers-color-scheme: light)').matches;
            theme = isLightTheme ? 'dark' : 'light';
          }

          elecAPI.setTheme(theme);
          userPreferences.set('themeOverride', theme);
          notify(`set theme to "${theme}"`, 'setTheme');
        },
        options: (_, args) => {
          const currentValue = userPreferences.get('themeOverride');

          return args.length < 2
            ? [
              option('system', currentValue === 'system' ? 'default (current)' : 'default'),
              option('light', currentValue === 'light' ? 'current' : undefined),
              option('dark', currentValue === 'dark' ? 'current' : undefined)
            ] 
            : [];
        }
      },
      'libraryCoverSize': {
        desc: 'set cover height size in pixels',
        run: (size = '200') => {
          let value = parseInt( size.trim() );
          if ( isNaN(value) || value < 100 )
            value = 200;

          userPreferences.set('libraryCoverSize', value);
          notify(`cover height sized to ${value}px`, 'coverSize');
        },
        options: (_, args) => {
          const currentValue = userPreferences.get('libraryCoverSize');

          return args.length < 2
            ? currentValue === 200
              ? [option('200', 'default (current)')]
              : [option('200', 'default'), option(`${currentValue}`, 'current')]
            : [];
        }
      },
      'libraryItemsPerPage': {
        desc: 'set how many items are displayed per page',
        run: (count = '100') => {
          let value = parseInt( count.trim() );
          if ( isNaN(value) || value < 10 )
            value = 100;

          userPreferences.set('libraryItemsPerPage', value);
          notify(`showing ${value} items per page`, 'itemsPerPage');
        },
        options: (_, args) => {
          const currentValue = userPreferences.get('libraryItemsPerPage');

          return args.length < 2
            ? currentValue === 100
              ? [option('100', 'default (current)')]
              : [option('100', 'default'), option(`${currentValue}`, 'current')]
            : [];
        }
      },
      'paletteHistorySize': {
        desc: 'set palette action history size',
        run: (limit = '10') => {
          let value = parseInt( limit.trim() );
          if ( isNaN(value) || value < 0 )
            value = 10;

          userPreferences.set('paletteHistorySize', value);
          notify(`set palette history size to ${value}`, 'historySize');
        },
        options: (_, args) => {
          const currentValue = userPreferences.get('paletteHistorySize');

          return args.length < 2
            ? currentValue === 10
              ? [option('10', 'default (current)')]
              : [option('10', 'default'), option(`${currentValue}`, 'current')]
            : [];
        }
      }
    }
  }
});
