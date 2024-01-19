import { ActionDB } from "../../actions/actionDB.js"
import { CoverGrid } from "./coverGrid.js"
import { option, standardFilter } from "../../appCli/appCLI.js"
import { FRAME as Library }  from "../../tabs/tab.js"
import { AppNotifier } from "../../app/notifier.js"


/**
 * Commands that can be user invoked by shortcuts on keyHandler or libCLI.
 */
ActionDB.setComponentActions('library', {

  'filter' : {
    'desc' : 'filter book by names or tags. Prepend a - to exclude tag',
    'run' : () => {},
    'options' : (query, allArgs) => {
      // inject tag completion if using 'tag:'
      if (query.slice(0, 4) == 'tag:') return elecAPI.tagAPI.uniqueTags()

      // treat queries
      const queries = allArgs.map(str => str.toLowerCase().trim()).filter(str => str)

      // display 'clear filter' on single empty arg, show filter otherwise
      if (allArgs.length == 1 && !query) AppNotifier.notify('clear filter', 'filter')
      else if (query) AppNotifier.notify(`filter: ${query}`, 'filter')
      
      Library.coverGrid.drawCovers(queries)
      return []
    },
    'customFilter': (query) => {
      if (query.slice(0, 4) == 'tag:') query = query.slice(4)
      return standardFilter(query)
    }
  },

  'tag': {
    'desc' : 'add or remove tags from current book',
    'run' : (action, ...tags) => {},

    'methods': {
      'add': {
        'desc': 'add one or more tags to current book',
        'run': (...tags) => tag(true, ...tags),
        'options': () => elecAPI.tagAPI.uniqueTags()
      },
      'del': {
        'desc': 'delete one or more tags from current book',
        'run': (...tags) => tag(false, ...tags),
        'options': () => {
          if (!CoverGrid.selection) return []
          return elecAPI.tagAPI.getTags(CoverGrid.selection.bookPath)
        }
      }
    }
  },

  'addFolder': {
    'desc' : 'add folder to library',
    'run' : () => Library.addToLibrary()
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

          Library.watchlistPanel.addPath(path)
          AppNotifier.notify(`added ${path} to Watchlist`)
        },
        'options': async (query) => await elecAPI.fileAPI.lsHint(query)
      },
      'remove': {
        'desc': 'remove folder to Watchlist',
        'run': (path) => {
          const validPath = path && path.trim()
          if (!validPath) return

          Library.watchlistPanel.removePath(path)
          AppNotifier.notify(`removed ${path} from Watchlist`)
        },
        'options': () => Object.keys( Library.watchlistPanel.getWatchObject() )
      },
      'sync': {
        'desc': 'synchronize books with Watchlist entries',
        'run': () => Library.syncToWatchlist()
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
        'run': () => {
          const hasSelection = CoverGrid.selection != null
          if (hasSelection) CoverGrid.selection.removeBook()
          AppNotifier.notify(hasSelection ? 'book delisted' : 'no book selected ', 'bookDelist')
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
    'run': () => Library.coverGrid.random()
  },
  
  'fullscreen': {
    'desc': 'toggle fullscreen',
    'run': () => {
      if (document.fullscreenElement) document.exitFullscreen()
      else document.body.requestFullscreen()
    }
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
    'run': () => {
      elecAPI.libAPI.clearLibrary()
      Library.coverGrid.reloadCovers()
      AppNotifier.notify('library book entries cleared')
    }
  },

})


/**
 * Add and remove tags for current book file.
 * @param {Boolean} add Add tags instead of removing them.
 * @param  {...String} tags Tags to associate to current file.
 */
async function tag(add = true, ...tags) {
  
  if (!CoverGrid.selection) {
    AppNotifier.notify('no book selected', 'tag')
    return
  }

  // treat tags
  tags = tags.map(tag => tag.toLowerCase().trim()).filter(tag => tag)
  
  const bookPath = CoverGrid.selection.bookPath
  if (!tags.length) return AppNotifier.notify('no tags to update')

  let success
  if (add) success = await elecAPI.tagAPI.tagFile(bookPath, ...tags)
  else success = await elecAPI.tagAPI.untagFile(bookPath, ...tags)

  AppNotifier.notify(`${success ? '' : 'no '}tags updated`, 'tag')
}
