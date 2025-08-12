import { setComponentActions } from "../../actions/actionService.js";
import { option, standardFilter } from "../../components/actionPalette/actionPalette.js";
import { FRAME }  from "../../tabs/tab.js";
import { runScript, tag } from "../../components/fileMethods.js";


setComponentActions('library', {

  'filter': {
    desc: 'filter books by name or tags, list tags with ?, prepend - to exclude it',
    run : () => {},
    options: (query, allArgs) => {
      // inject tag completion if query begins with '?'
      if (query[0] === '?')
        return elecAPI.uniqueTags();

      // treat queries
      const queries = allArgs
        .map( str => str.toLowerCase().trim() )
        .filter(str => str);

      // display 'clear filter' on single empty arg, show filter otherwise
      if (allArgs.length === 1 && query === '')
        FRAME.notify('clear filter', 'filter');
      else if (query !== '')
        FRAME.notify(`filter: ${query}`, 'filter');

      FRAME.coverGrid.drawCovers(queries);
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
        run: (...tags) => tag(FRAME.coverGrid.selectedCover?.bookPath, true, ...tags),
        options: () => elecAPI.uniqueTags()
      },
      'del': {
        desc: 'delete one or more tags from current book',
        run: (...tags) => tag(FRAME.coverGrid.selectedCover?.bookPath, false, ...tags),
        options: () => FRAME.coverGrid.selectedCover != null
          ? elecAPI.getTags(FRAME.coverGrid.selectedCover.bookPath)
          : []
      }
    }
  },

  'addToLibrary': {
    desc: 'add folders/archives to library',
    run: async (...paths) => await FRAME.addToLibrary(...paths),
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
            FRAME.notify(`"${treatedPath}" is not a valid path`, 'watchAdd');
          else {
            FRAME.watchlistPanel.addItem(treatedPath);
            FRAME.notify(`added "${treatedPath}" to Watchlist`, 'watchAdd');
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
            FRAME.notify(`"${treatedPath}" is not a valid path`);
          else {
            FRAME.watchlistPanel.removeItem(treatedPath)
              ? FRAME.notify(`removed ${treatedPath} from Watchlist`, 'watchRemove')
              : FRAME.notify(`no "${treatedPath}" in watchlist to remove`, 'watchRemove');
          }
        },
        options: (_query, allArgs) => allArgs.length < 2
          ? FRAME.watchlistPanel.getItems().map(i => i.path)
          : []
      },
      'sync': {
        desc: 'synchronize books with Watchlist entries',
        run: async () => await FRAME.syncToWatchlist()
      },
      'panel': {
        desc: 'open or close Watchlist panel',
        run: (option) => {
          const values = { 'open': true, 'close': false };
          FRAME.watchlistPanel.toggleVisibility(values[option]);
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
          const cover = FRAME.coverGrid.selectedCover;

          cover != null
            ? FRAME.coverGrid.openCoverBook(cover, whichTab === 'newTab')
            : FRAME.notify('no selected cover to open', 'bookOpen');
        },
        options: (_query, allArgs) => allArgs.length < 2 ? [
          option('newTab', 'open book in a new tab'),
          option('inPlace', 'open book on current tab (default)'),
        ] : []
      },
      'delist': {
        desc: 'delist currently selected book from library',
        run: async () => {
          const cover = FRAME.coverGrid.selectedCover;
          if (cover == null) 
            return FRAME.notify('no book selected ', 'bookDelist');

          if ( await FRAME.coverGrid.removeCover(cover) )
            FRAME.notify('book delisted', 'bookDelist');
          else
            FRAME.notify('failed to delist book', 'bookDelist');
        }
      }
    }
  },

  'moveSelection': {
    desc: 'move book selection',
    run: (axis, next = 'next') => {
      if (axis === 'horizontally')
        FRAME.coverGrid.nextCoverHorizontal(next === 'next');
      if (axis === 'vertically')
        FRAME.coverGrid.nextCoverVertical(next === 'next');
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
    run: () => FRAME.coverGrid.randomCover()
  },

  'coverSize': {
    desc: 'set cover height size in pixels (default: 200)',
    run: (size = '200') => {
      let value = parseInt( size.trim() );
      if ( isNaN(value) || value < 100 )
        value = 200;

      FRAME.coverGrid.setCoverSize(value);
      FRAME.notify(`cover height sized to ${value}px`, 'coverSize');
    }
  },

  'itemsPerPage': {
    desc: 'set how many items are displayed per page (default: 100)',
    run: (count = '100') => {
      let value = parseInt( count.trim() );
      if ( isNaN(value) || value < 10 )
        value = 100;

      FRAME.coverGrid.setItemsPerPage(value);
      FRAME.notify(`showing ${value} items per page`, 'itemsPerPage');
    }
  },

  'nukeLibrary' : {
    desc: 'completely delist entire library',
    run: async () => {
      if ( !await elecAPI.clearLibrary() )
        FRAME.notify('failed to clear library book entries', 'nukeLibrary');
      else {
        FRAME.notify('library book entries cleared', 'nukeLibrary');
        FRAME.coverGrid.reloadCovers();
      }
    }
  },

  'runScript': {
    desc: 'run user script where %F, %N, %T represent the selected file path, \
           name & type, respectively : <script> <displayMsg?>',
    run: async (script, msg) => {
      await runScript(script, FRAME.coverGrid.selectedCover?.bookPath, msg);
    }
  }
});
