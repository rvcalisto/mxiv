import { ActionService } from "../../actions/actionService.js"
import { CoverGrid } from "./coverGrid.js"
import { option, standardFilter } from "../../components/appCli/appCLI.js"
import { FRAME as Library }  from "../../tabs/tab.js"
import { AppNotifier } from "../../components/notifier.js"
import { runScript, tag } from "../../components/fileMethods.js"


ActionService.setComponentActions('library', {

  'filter' : {
    'desc' : 'filter books by name or tags, list tags with ?, prepend - to exclude it',
    'run' : () => {},
    'options' : (query, allArgs) => {
      // inject tag completion if query begins with '?'
      if (query[0] === '?') return elecAPI.uniqueTags()

      // treat queries
      const queries = allArgs.map(str => str.toLowerCase().trim()).filter(str => str)

      // display 'clear filter' on single empty arg, show filter otherwise
      if (allArgs.length == 1 && !query) AppNotifier.notify('clear filter', 'filter')
      else if (query) AppNotifier.notify(`filter: ${query}`, 'filter')
      
      Library.coverGrid.drawCovers(queries)
      return []
    },
    'customFilter': (query) => {
      if (query[0] === '?') query = query.slice(1)
      return standardFilter(query)
    }
  },

  'tag': {
    'desc' : 'add or remove tags from current book',
    'run' : (action, ...tags) => {},

    'methods': {
      'add': {
        'desc': 'add one or more tags to current book',
        'run': (...tags) => {
          tag(CoverGrid.selection?.bookPath, true, ...tags)
        },
        'options': () => elecAPI.uniqueTags()
      },
      'del': {
        'desc': 'delete one or more tags from current book',
        'run': (...tags) => {
          tag(CoverGrid.selection?.bookPath, false, ...tags)
        },
        'options': () => {
          if (!CoverGrid.selection) return []
          return elecAPI.getTags(CoverGrid.selection.bookPath)
        }
      }
    }
  },

  'addToLibrary': {
    'desc' : 'add folders/archives to library',
    'run' : async (...paths) => await Library.addToLibrary(...paths),
    'options': async (query) => await elecAPI.queryPath(query)
  },

  'watchlist': {
    'desc': 'toggle panel, add or remove paths from Watchlist',
    'run': (action, path) => Library.watchlistPanel.toggleVisibility(),

    'methods': {
      'add': {
        'desc': 'add folder to Watchlist',
        'run': (path) => {
          const validPath = path && path.trim()
          if (!validPath) return

          Library.watchlistPanel.addItem(path)
          AppNotifier.notify(`added ${path} to Watchlist`)
        },
        'options': async (query) => await elecAPI.queryPath(query)
      },
      'remove': {
        'desc': 'remove folder to Watchlist',
        'run': (path) => {
          const validPath = path && path.trim()
          if (!validPath) return

          Library.watchlistPanel.removeItem(path)
          AppNotifier.notify(`removed ${path} from Watchlist`)
        },
        'options': () => Library.watchlistPanel.getItems().map(i => i.path)
      },
      'sync': {
        'desc': 'synchronize books with Watchlist entries',
        'run': async () => await Library.syncToWatchlist()
      },
      'close': {
        'desc': 'close Watchlist if open',
        'run': () => {
          const watchlistPanel = Library.watchlistPanel
          if (watchlistPanel.isVisible) watchlistPanel.toggleVisibility(false)
        }
      }
    }
  },

  'book': {
    'desc': 'open or delist selected book',
    'run': () => {},
    'methods': {
      'open': {
        'desc': 'open currently selected book in-place or on a new tab',
        'run': (whichTab = 'inPlace') => {
          Library.coverGrid.openCoverBook(whichTab === 'newTab')
        },
        'options': (query, allArgs) => allArgs.length < 2 ? [
          option('newTab', 'open book in a new tab'),
          option('inPlace', 'open book on current tab (default)'),
        ] : []
      },
      'delist': {
        'desc': 'delist currently selected book from library',
        'run': async () => {
          const cover = CoverGrid.selection
          if (!cover) 
            return AppNotifier.notify('no book selected ', 'bookDelist')

          const success = await Library.coverGrid.removeCover(cover)
          if (success) AppNotifier.notify('book delisted', 'bookDelist')
        }
      }
    }
  },

  'moveSelection': {
    'desc': 'move book selection',
    'run': (axis, next = 'next') => {
      if (axis === 'horizontally') Library.coverGrid.nextCoverHorizontal(next === 'next')
      if (axis === 'vertically') Library.coverGrid.nextCoverVertical(next === 'next')
    },
    'options': (lastArg, allArgs) => {
      if (allArgs.length === 1) return [
        option('horizontally', 'select neighbor in the horizontal'),
        option('vertically', 'select neighbor in the vertical')
      ]
      if (allArgs.length === 2) return [
        option('next', 'horizontal: right, vertical: down (default)'),
        option('back', 'horizontal: left, vertical: up')
      ]
      return []
    }
  },

  'random': {
    'desc': 'select random book',
    'run': () => Library.coverGrid.randomCover()
  },

  'setCoverSize': {
    'desc': 'set cover height size in pixels, default is 200',
    'run': (size = '200') => {
      if (isNaN(parseInt(size))) {
        AppNotifier.notify(`${size} is not a number`, 'setSize')
        return
      }
      
      if (!size.trim()) size = '200'
      document.body.style.setProperty('--cover-height', size + 'px')
    }
  },

  'nukeLibrary' : {
    'desc': 'completely delist entire library',
    'run': async () => {
      const success = await elecAPI.clearLibrary()
      if (!success) return

      AppNotifier.notify('library book entries cleared')
      Library.coverGrid.reloadCovers()
    }
  },

  'runScript': {
    'desc' : 'run user script where %F, %N, %T represent the selected file path, \
      name & type, respectively : <script> <displayMsg?>',
    'run'  : async (script, msg) => {
      await runScript(script, CoverGrid.selection?.bookPath, msg);
    }
  },

})
