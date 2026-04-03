// Books page initialization — called on full page load and after AJAX navigation
window.initBooksPage = function() {
  var documentListeners = [];

  function addDocListener(event, handler) {
    document.addEventListener(event, handler);
    documentListeners.push({ event: event, handler: handler });
  }

  // --- Infinite Scroll, Filters, Sort ---
  (function() {
    var grid = document.querySelector('.books-grid');
    var wrapper = document.querySelector('.main-content');
    var spinner = document.getElementById('books-loading');
    var clearBtn = document.getElementById('clear-filters');
    var filterContainer = document.getElementById('sidebar-filters');
    var searchInput = document.getElementById('live-search');
    var sortDropdown = document.querySelector('.sort-dropdown');
    var sortPopover = document.querySelector('.sort-popover');
    if (!grid || !wrapper || !spinner) return;

    var loading = false;
    var currentSort = sortDropdown ? (sortDropdown.dataset.currentSort || 'new') : 'new';

    // --- Infinite Scroll ---
    function loadMore(callback) {
      var nextUrl = grid.dataset.nextUrl;
      if (!nextUrl || loading) { if (callback) callback(false); return; }

      loading = true;
      spinner.style.display = 'flex';

      fetch(nextUrl)
        .then(function(r) { return r.text(); })
        .then(function(html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var newGrid = doc.querySelector('.books-grid');
          if (!newGrid) { done(false); return; }

          newGrid.querySelectorAll('.book-cover').forEach(function(cover) {
            grid.appendChild(cover);
          });

          var newNext = newGrid.dataset.nextUrl;
          if (newNext) {
            grid.dataset.nextUrl = newNext;
          } else {
            delete grid.dataset.nextUrl;
          }
          done(true);
        })
        .catch(function() { done(false); });

      function done(loaded) {
        spinner.style.display = 'none';
        loading = false;
        if (callback) callback(loaded);
      }
    }

    wrapper.addEventListener('scroll', function() {
      if (wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight < 300) {
        loadMore();
      }
    });

    // Pre-check filter checkboxes from URL params
    if (filterContainer) {
      var urlParams = new URLSearchParams(window.location.search);
      filterContainer.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
        var type = cb.dataset.filterType;
        var paramVal = urlParams.get(type);
        if (!paramVal) return;
        var values = paramVal.split(',');
        var cbVal = cb.dataset.filterId || cb.dataset.filterValue;
        if (values.indexOf(cbVal) !== -1) {
          cb.checked = true;
        }
      });
      if (clearBtn) {
        var hasChecked = filterContainer.querySelector('input[type="checkbox"]:checked');
        clearBtn.style.display = hasChecked ? '' : 'none';
      }
    }

    // --- Filter Logic ---
    function getActiveFilters() {
      var filters = {};
      if (!filterContainer) return filters;
      var checked = filterContainer.querySelectorAll('input[type="checkbox"]:checked');
      checked.forEach(function(cb) {
        var type = cb.dataset.filterType;
        var val = cb.dataset.filterId || cb.dataset.filterValue;
        if (!filters[type]) filters[type] = [];
        filters[type].push(val);
      });
      return filters;
    }

    function buildFilterUrl(sortParam) {
      var filters = getActiveFilters();
      var params = [];
      if (sortParam) params.push('sort=' + sortParam);
      for (var type in filters) {
        params.push(type + '=' + filters[type].join(','));
      }
      var term = searchInput ? searchInput.value.trim() : '';
      if (term) params.push('query=' + encodeURIComponent(term));
      return '/books?' + params.join('&');
    }

    var activeController = null;

    function fetchFiltered() {
      var hasFilters = Object.keys(getActiveFilters()).length > 0;
      if (clearBtn) clearBtn.style.display = hasFilters ? '' : 'none';
      if (spinner) spinner.style.display = 'flex';

      if (activeController) activeController.abort();
      activeController = new AbortController();

      var filterUrl = buildFilterUrl(currentSort);
      history.pushState(null, '', filterUrl);
      fetch(filterUrl, { signal: activeController.signal })
        .then(function(r) { return r.text(); })
        .then(function(html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var newGrid = doc.querySelector('.books-grid');
          if (!newGrid) return;

          grid.style.transition = 'opacity 0.15s ease';
          grid.style.opacity = '0';

          setTimeout(function() {
            grid.innerHTML = newGrid.innerHTML;

            var newNext = newGrid.dataset.nextUrl;
            if (newNext) {
              grid.dataset.nextUrl = newNext;
            } else {
              delete grid.dataset.nextUrl;
            }

            var saved = localStorage.getItem('coverSize');
            if (saved) grid.style.setProperty('--cover-size', saved + 'px');

            grid.style.opacity = '1';
            setTimeout(function() { grid.style.transition = ''; }, 150);
            if (spinner) spinner.style.display = 'none';
          }, 150);
        })
        .catch(function() {
          if (spinner) spinner.style.display = 'none';
        });
    }

    // Empty shelf dialog
    var emptyShelfDialog = document.getElementById('empty-shelf-dialog');
    var emptyShelfHeading = document.getElementById('empty-shelf-heading');

    function showEmptyShelfDialog(name) {
      if (!emptyShelfDialog) return;
      emptyShelfHeading.textContent = '"' + name + '" is empty';
      emptyShelfDialog.style.display = '';
    }

    function hideEmptyShelfDialog() {
      if (emptyShelfDialog) emptyShelfDialog.style.display = 'none';
    }

    if (emptyShelfDialog) {
      emptyShelfDialog.querySelector('.dialog-close').addEventListener('click', hideEmptyShelfDialog);
      emptyShelfDialog.addEventListener('click', function(e) {
        if (e.target === emptyShelfDialog) hideEmptyShelfDialog();
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && emptyShelfDialog.style.display !== 'none') hideEmptyShelfDialog();
      });
    }

    // Listen for checkbox changes
    if (filterContainer) {
      filterContainer.addEventListener('change', function(e) {
        if (e.target.matches('input[type="checkbox"]')) {
          // Check if an empty shelf was just checked
          if (e.target.checked && e.target.dataset.filterType === 'shelf' && e.target.dataset.bookCount === '0') {
            e.target.checked = false;
            showEmptyShelfDialog(e.target.dataset.filterValue);
            return;
          }
          fetchFiltered();
        }
      });
    }

    // Live search (server-side with debounce)
    if (searchInput) {
      var searchTimer;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function() {
          fetchFiltered();
        }, 150);
      });
    }

    // // Client-side search (commented out — may revisit for hybrid approach)
    // if (searchInput) {
    //   var searchTimer;
    //   searchInput.addEventListener('input', function() {
    //     clearTimeout(searchTimer);
    //     searchTimer = setTimeout(function() {
    //       var term = searchInput.value.trim().toLowerCase();
    //       grid.querySelectorAll('.book-cover').forEach(function(cover) {
    //         if (!term) { cover.style.display = ''; return; }
    //         var title = (cover.dataset.title || '').toLowerCase();
    //         var author = (cover.dataset.author || '').toLowerCase();
    //         cover.style.display = (title.indexOf(term) !== -1 || author.indexOf(term) !== -1) ? '' : 'none';
    //       });
    //     }, 150);
    //   });
    // }

    // Clear filters button
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (filterContainer) {
          filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
            cb.checked = false;
          });
        }
        if (searchInput) searchInput.value = '';
        fetchFiltered();
      });
    }

    // --- Sort Handler ---
    if (sortDropdown && sortPopover) {
      var sortLabels = {
        abc: 'Title: A\u2013Z', zyx: 'Title: Z\u2013A',
        authaz: 'Author: A\u2013Z', authza: 'Author: Z\u2013A',
        pubold: 'Published: Old to New', pubnew: 'Published: New to Old',
        'new': 'Added: New to Old', old: 'Added: Old to New'
      };

      function updateActiveOption() {
        sortPopover.querySelectorAll('.sort-option').forEach(function(btn) {
          btn.style.display = btn.dataset.sort === currentSort ? 'none' : '';
        });
      }
      updateActiveOption();

      sortPopover.addEventListener('click', function(e) {
        var btn = e.target.closest('.sort-option');
        if (!btn) return;

        var newSort = btn.dataset.sort;
        if (newSort === currentSort) return;

        sortDropdown.removeAttribute('open');
        sortDropdown.querySelector('.sort-button').textContent = sortLabels[newSort] || 'Sort';

        currentSort = newSort;
        sortDropdown.dataset.currentSort = newSort;
        updateActiveOption();

        fetchFiltered();
      });
    }
  })();


  // --- Book Popover ---
  var bookPopoverClose = null;
  (function() {
    var popover = document.getElementById('book-popover');
    var grid = document.querySelector('.books-grid');
    var overlay = document.getElementById('popover-overlay');
    if (!popover || !grid) return;

    var activeCard = null;

    // Register book popover with unified manager
    bookPopoverClose = window.Popovers.register(function() { hidePopover(); });

    function showPopover(cover) {
      // Close all other popovers (sort, user settings, etc.)
      window.Popovers.closeAll(bookPopoverClose);

      document.querySelector('.main-content').style.overflowY = 'hidden';
      document.getElementById('popover-title').textContent = cover.dataset.title || '';
      document.getElementById('popover-author').textContent = cover.dataset.author || '';
      var rating = cover.dataset.rating;
      document.getElementById('popover-rating').textContent = rating ? '\u2605 ' + parseFloat(rating).toFixed(1) + ' / 5' : '';
      document.getElementById('popover-description').textContent = cover.dataset.description || '';

      var readBtn = document.getElementById('popover-read-btn');
      var detailsBtn = document.getElementById('popover-details-btn');

      var readUrl = cover.dataset.readUrl;
      if (readUrl) {
        readBtn.style.display = '';
        readBtn.onclick = function() { window.location.href = readUrl; };
      } else {
        readBtn.style.display = 'none';
      }

      detailsBtn.onclick = function() {
        var detailUrl = cover.dataset.detailUrl;
        if (detailUrl) {
          if (window.navigateAjax) {
            window.navigateAjax(detailUrl);
          } else {
            window.location.href = detailUrl;
          }
        }
      };

      // Measure height before positioning (hidden so no flash)
      popover.classList.remove('arrow-right');
      popover.style.visibility = 'hidden';
      popover.style.display = 'block';

      var pw = popover.offsetWidth;
      var ph = popover.offsetHeight;
      var rect = cover.getBoundingClientRect();
      var gap = 12;

      // Try placing to the right; flip left if it would overflow
      var left = rect.right + gap;
      if (left + pw > window.innerWidth - 8) {
        left = rect.left - gap - pw;
        popover.classList.add('arrow-right');
      }

      // Vertically center on the cover, clamped to viewport
      var top = rect.top + rect.height / 2 - ph / 2;
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));

      popover.style.top = top + 'px';
      popover.style.left = left + 'px';
      popover.style.visibility = '';
      popover.classList.remove('animating');
      void popover.offsetWidth; // forces the browser to reflow so the animation replays
      popover.classList.add('animating');

      activeCard = cover;
      overlay.style.display = 'block';
      activeCard.style.position = 'relative';
      activeCard.style.zIndex = '51';
    }

    function hidePopover() {
      document.querySelector('.main-content').style.overflowY = '';
      popover.style.display = 'none';
      overlay.style.display = 'none';
      if (activeCard) {
        activeCard.style.position = '';
        activeCard.style.zIndex = '';
      }
      activeCard = null;
    }

    function scrollToCover(cover, callback) {
      var wrapper = document.querySelector('.main-content');
      var rect = cover.getBoundingClientRect();
      var wrapperRect = wrapper.getBoundingClientRect();
      var coverCenter = rect.top + rect.height / 2;
      var wrapperCenter = wrapperRect.top + wrapperRect.height / 2;
      var offset = coverCenter - wrapperCenter;

      if (Math.abs(offset) < 20) {
        callback();
        return;
      }

      var duration = 75;
      var start = wrapper.scrollTop;
      var startTime = null;

      function step(time) {
        if (!startTime) startTime = time;
        var t = Math.min((time - startTime) / duration, 1);
        var ease = t * (2 - t); // ease-out
        wrapper.scrollTop = start + offset * ease;
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          requestAnimationFrame(callback);
        }
      }
      requestAnimationFrame(step);
    }

    // Event delegation - works for covers loaded by infinite scroll too
    grid.addEventListener('click', function(e) {
      var cover = e.target.closest('.book-cover');
      if (cover) {
        if (activeCard === cover) {
          hidePopover();
        } else {
          scrollToCover(cover, function() { showPopover(cover); });
        }
        e.stopPropagation();
      }
    });

    // Click outside closes book popover
    addDocListener('click', function(e) {
      if (activeCard && !popover.contains(e.target) && !e.target.closest('.book-cover')) {
        hidePopover();
      }
    });

    // Close button
    document.getElementById('popover-close').addEventListener('click', function(e) {
      e.stopPropagation();
      hidePopover();
    });

    // Clicks inside the popover don't bubble up and close it
    popover.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  })();


  // Upload
  var uploadInput = document.getElementById('upload-file-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', function() {
      if (this.files.length > 0) {
        var form = document.getElementById('upload-form');
        var formData = new FormData(form);
        var fab = document.querySelector('.fab-button');
        if (fab) { fab.disabled = true; fab.style.opacity = '0.5'; }

        fetch(form.action, { method: 'POST', body: formData })
          .then(function(r) { return r.json(); })
          .then(function(data) {
            if (data.location) {
              window.location.href = data.location;
            } else {
              window.location.reload();
            }
          })
          .catch(function() {
            window.location.reload();
          });
      }
    });
  }


  // Cover Size Slider
  (function() {
    var slider = document.getElementById('cover-size-slider');
    var grid = document.querySelector('.books-grid');
    if (!slider || !grid) return;

    var saved = localStorage.getItem('coverSize');
    if (saved) {
      slider.value = saved;
      grid.style.setProperty('--cover-size', saved + 'px');
    }

    slider.addEventListener('input', function() {
      grid.style.setProperty('--cover-size', this.value + 'px');
    });

    slider.addEventListener('change', function() {
      localStorage.setItem('coverSize', this.value);
    });
  })();


  // Keyboard shortcuts
  addDocListener('keydown', function(e) {
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
      e.preventDefault();
      var si = document.getElementById('live-search');
      if (si) si.focus();
    }
    if (e.key === 'Escape' && e.target.id === 'live-search') {
      e.target.blur();
    }
  });


  // --- Cleanup function (called before AJAX page swap) ---
  return function destroyBooksPage() {
    // Remove document-level listeners
    documentListeners.forEach(function(entry) {
      document.removeEventListener(entry.event, entry.handler);
    });
    documentListeners = [];

    // Unregister book popover from Popovers manager
    if (bookPopoverClose && window.Popovers && window.Popovers.unregister) {
      window.Popovers.unregister(bookPopoverClose);
    }
  };
};
