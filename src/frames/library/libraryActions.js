import { setComponentActions } from "../../actions/actionService.js";
import { option, standardFilter, setPaletteInfo } from "../../components/actionPalette/actionPalette.js";
import { FRAME } from "../../tabs/tab.js";
import { runScript, tag, renameTags, deleteTags } from "../../components/fileMethods.js";


/**
 * @import { Library } from "./library.js"
 */


// [Workaround] get type check support for current FRAME.
const frame = () => /** @type {Library} */ (FRAME);


setComponentActions('library', {

  'filter': {
    desc: 'filter books by name or tags, list tags with ?, prepend - to exclude it',
    run : () => {},
    options: (query, allArgs) => {
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
        frame().notify('clear filter', 'filter');
      else if (query !== '')
        frame().notify(`filter: ${query}`, 'filter');

      frame().coverGrid.drawCovers(queries);
      return [];
    },
    customFilter: (query) => {
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
        run: (...tags) => {
          const selectedCover = frame().coverGrid.selectedCover;

          if (selectedCover != null)
            tag(selectedCover.bookPath, true, ...tags);
        },
        options: () => elecAPI.uniqueTags()
      },
      'del': {
        desc: 'delete one or more tags from current book',
        run: (...tags) => {
          const selectedCover = frame().coverGrid.selectedCover;

          if (selectedCover != null)
            tag(selectedCover.bookPath, false, ...tags);
        },
        options: () => {
          const selectedCover = frame().coverGrid.selectedCover;

          return selectedCover != null
            ? elecAPI.getTags(selectedCover.bookPath)
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
  },

  'addToLibrary': {
    desc: 'add folders/archives to library',
    run: async (...paths) => await frame().addToLibrary(...paths),
    options: async (query) => await elecAPI.queryPath(query)
  },

  'watchlist': {
    desc: 'toggle panel, add or remove paths from Watchlist',
    actions: {
      'add': {
        desc: 'add folder to Watchlist',
        run: (path = '') => {
          const treatedPath = path.trim();
          if (treatedPath === '')
            frame().notify(`"${treatedPath}" is not a valid path`, 'watchAdd');
          else {
            frame().watchlistPanel.addItem(treatedPath);
            frame().notify(`added "${treatedPath}" to Watchlist`, 'watchAdd');
          }
        },
        options: async (query, allArgs) => allArgs.length < 2
          ? await elecAPI.queryPath(query)
          : []
      },
      'remove': {
        desc: 'remove folder to Watchlist',
        run: (path = '') => {
          const treatedPath = path.trim();
          if (treatedPath === '')
            frame().notify(`"${treatedPath}" is not a valid path`);
          else {
            frame().watchlistPanel.removeItem(treatedPath)
              ? frame().notify(`removed ${treatedPath} from Watchlist`, 'watchRemove')
              : frame().notify(`no "${treatedPath}" in watchlist to remove`, 'watchRemove');
          }
        },
        options: (_query, allArgs) => allArgs.length < 2
          ? frame().watchlistPanel.getItems().map(i => i.path)
          : []
      },
      'sync': {
        desc: 'synchronize books with Watchlist entries',
        run: async () => await frame().syncToWatchlist()
      },
      'panel': {
        desc: 'open or close Watchlist panel',
        run: (option) => {
          const values = /** @type {Object<string, boolean>} */ ({ 'open': true, 'close': false });
          frame().watchlistPanel.toggleVisibility(values[option]);
        },
        options: (_query, allArgs) => allArgs.length < 2 
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
        run: (whichTab = 'inPlace') => {
          const cover = frame().coverGrid.selectedCover;

          cover != null
            ? frame().coverGrid.openCoverBook(cover, whichTab === 'newTab')
            : frame().notify('no selected cover to open', 'bookOpen');
        },
        options: (_query, allArgs) => allArgs.length < 2 ? [
          option('newTab', 'open book in a new tab'),
          option('inPlace', 'open book on current tab (default)'),
        ] : []
      },
      'delist': {
        desc: 'delist currently selected book from library',
        run: async () => {
          const cover = frame().coverGrid.selectedCover;
          if (cover == null) 
            return frame().notify('no book selected ', 'bookDelist');

          if ( await frame().coverGrid.removeCover(cover) )
            frame().notify('book delisted', 'bookDelist');
          else
            frame().notify('failed to delist book', 'bookDelist');
        }
      }
    }
  },

  'moveSelection': {
    desc: 'move book selection',
    run: (axis, next = 'next') => {
      if (axis === 'horizontally')
        frame().coverGrid.nextCoverHorizontal(next === 'next');
      if (axis === 'vertically')
        frame().coverGrid.nextCoverVertical(next === 'next');
    },
    options: (_query, allArgs) => {
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
    run: () => frame().coverGrid.randomCover()
  },

  'nukeLibrary' : {
    desc: 'completely delist entire library',
    run: async () => {
      if ( await frame().nukeLibrary() )
        frame().notify('library book entries cleared', 'nukeLibrary');
      else
        frame().notify('failed to clear library book entries', 'nukeLibrary');
    }
  },

  'runScript': {
    desc: 'run user script where %F, %N, %T represent the selected file path, \
           name & type, respectively',
    run: async (script, msg) => {
      await runScript(script, frame().coverGrid.selectedCover?.bookPath, msg);
    },
    options: (_query, allArgs) => {
      if (allArgs.length < 3)
        setPaletteInfo('arguments: <script, %F: filepath, %N: basename, %T: filetype> [notification]');

      return [];
    }
  }
});
