import { setComponentActions } from "../../actions/actionService.js";
import { option, standardFilter, setPaletteInfo } from "../../components/actionPalette/actionPalette.js";
import { runScript, tag, renameTags, deleteTags } from "../../components/fileMethods.js";


/**
 * @import { Library } from "./library.js"
 * @import { ActionSet } from "../../actions/componentActions.js"
 */


/**
 * @type {ActionSet<Library>}
 */
const libraryActions = {

  'filter': {
    desc: 'filter books by name or tags, list tags with ?, prepend - to exclude it',
    run: () => {},
    options: (library, query, allArgs) => {
      setPaletteInfo('arguments: [[-]string...], ?: list tags');

      // inject tag completion if query begins with '?'
      if (query[0] === '?')
        return elecAPI.uniqueTags();

      // treat queries
      const queries = allArgs
        .map( str => str.toLowerCase().trim() )
        .filter(str => str);

      // display 'clear filter' on single empty arg, show filter otherwise
      if (allArgs.length === 1 && query === '')
        library.notify('clear filter', 'filter');
      else if (query !== '')
        library.notify(`filter: ${query}`, 'filter');

      library.coverGrid.drawCovers(queries);
      return [];
    },
    customFilter: (_library, query) => {
      if (query[0] === '?')
        query = query.slice(1);

      return standardFilter(query);
    }
  },

  'tag': {
    desc : 'add or remove tags from current book',
    actions: {
      'add': {
        desc: 'add one or more tags to current book',
        run: (library, ...tags) => {
          const selectedCover = library.coverGrid.selectedCover;

          if (selectedCover != null)
            tag(selectedCover.bookPath, true, ...tags);
        },
        options: () => elecAPI.uniqueTags()
      },
      'del': {
        desc: 'delete one or more tags from current book',
        run: (library, ...tags) => {
          const selectedCover = library.coverGrid.selectedCover;

          if (selectedCover != null)
            tag(selectedCover.bookPath, false, ...tags);
        },
        options: (library) => {
          const selectedCover = library.coverGrid.selectedCover;

          return selectedCover != null
            ? elecAPI.getTags(selectedCover.bookPath)
            : [];
        }
      },
      'rename': {
        desc: 'rename all occurrences of one or more tags',
        run: async (_library, ...tags) => await renameTags(...tags),
        options: () => elecAPI.uniqueTags()
      },
      'purge': {
        desc: 'purge all occurrences of one or more tags',
        run: async (_library, ...tags) => await deleteTags(...tags),
        options: () => elecAPI.uniqueTags()
      }
    }
  },

  'addToLibrary': {
    desc: 'add folders/archives to library',
    run: async (library, ...paths) => await library.addToLibrary(...paths),
    options: async (_library, query) => await elecAPI.queryPath(query)
  },

  'watchlist': {
    desc: 'toggle panel, add or remove paths from Watchlist',
    actions: {
      'add': {
        desc: 'add folder to Watchlist',
        run: (library, path = '') => {
          const treatedPath = path.trim();
          if (treatedPath === '')
            library.notify(`"${treatedPath}" is not a valid path`, 'watchAdd');
          else {
            library.watchlistPanel.addItem(treatedPath);
            library.notify(`added "${treatedPath}" to Watchlist`, 'watchAdd');
          }
        },
        options: async (_library, query, allArgs) => allArgs.length < 2
          ? await elecAPI.queryPath(query)
          : []
      },
      'remove': {
        desc: 'remove folder to Watchlist',
        run: (library, path = '') => {
          const treatedPath = path.trim();
          if (treatedPath === '')
            library.notify(`"${treatedPath}" is not a valid path`);
          else {
            library.watchlistPanel.removeItem(treatedPath)
              ? library.notify(`removed ${treatedPath} from Watchlist`, 'watchRemove')
              : library.notify(`no "${treatedPath}" in watchlist to remove`, 'watchRemove');
          }
        },
        options: (library, _query, allArgs) => allArgs.length < 2
          ? library.watchlistPanel.getItems().map(i => i.path)
          : []
      },
      'sync': {
        desc: 'synchronize books with Watchlist entries',
        run: async (library) => await library.syncToWatchlist()
      },
      'panel': {
        desc: 'open or close Watchlist panel',
        run: (library, option) => {
          const values = /** @type {Object<string, boolean>} */ ({ 'open': true, 'close': false });
          library.watchlistPanel.toggleVisibility(values[option]);
        },
        options: (_library, _query, allArgs) => allArgs.length < 2 
          ? [option('toggle', '(default)'), 'open', 'close']
          : []
      }
    }
  },

  'book': {
    desc: 'open or delist selected book',
    actions: {
      'open': {
        desc: 'open currently selected book in-place or on a new tab',
        run: (library, whichTab = 'inPlace') => {
          const cover = library.coverGrid.selectedCover;

          cover != null
            ? library.coverGrid.openCoverBook(cover, whichTab === 'newTab')
            : library.notify('no selected cover to open', 'bookOpen');
        },
        options: (_library, _query, allArgs) => allArgs.length < 2 ? [
          option('newTab', 'open book in a new tab'),
          option('inPlace', 'open book on current tab (default)'),
        ] : []
      },
      'delist': {
        desc: 'delist currently selected book from library',
        run: async (library) => {
          const cover = library.coverGrid.selectedCover;
          if (cover == null) 
            return library.notify('no book selected ', 'bookDelist');

          if ( await library.coverGrid.removeCover(cover) )
            library.notify('book delisted', 'bookDelist');
          else
            library.notify('failed to delist book', 'bookDelist');
        }
      }
    }
  },

  'moveSelection': {
    desc: 'move book selection',
    run: (library, axis, next = 'next') => {
      if (axis === 'horizontally')
        library.coverGrid.nextCoverHorizontal(next === 'next');
      if (axis === 'vertically')
        library.coverGrid.nextCoverVertical(next === 'next');
    },
    options: (_library, _query, allArgs) => {
      if (allArgs.length < 2) return [
        option('horizontally', 'select neighbor in the horizontal'),
        option('vertically', 'select neighbor in the vertical')
      ];

      if (allArgs.length < 3) return [
        option('next', 'horizontal: right, vertical: down (default)'),
        option('back', 'horizontal: left, vertical: up')
      ];

      return [];
    }
  },

  'random': {
    desc: 'select random book',
    run: (library) => library.coverGrid.randomCover()
  },

  'nukeLibrary' : {
    desc: 'completely delist entire library',
    run: async (library) => {
      if ( await library.nukeLibrary() )
        library.notify('library book entries cleared', 'nukeLibrary');
      else
        library.notify('failed to clear library book entries', 'nukeLibrary');
    }
  },

  'runScript': {
    desc: 'run user script where %F, %N, %T represent the selected file path, \
           name & type, respectively',
    run: async (library, script, msg) => {
      await runScript(script, library.coverGrid.selectedCover?.bookPath, msg);
    },
    options: (_library, _query, allArgs) => {
      if (allArgs.length < 3)
        setPaletteInfo('arguments: <script, %F: filepath, %N: basename, %T: filetype> [notification]');

      return [];
    }
  }
};


setComponentActions('library', libraryActions);
