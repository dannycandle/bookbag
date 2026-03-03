// Books page initialization — called on full page load and after AJAX navigation
window.initBooksPage = function() {
  var documentListeners = [];

  function addDocListener(event, handler) {
    document.addEventListener(event, handler);
    documentListeners.push({ event: event, handler: handler });
  }

  // --- Infinite Scroll + Filters ---
  (function() {
    var grid = document.querySelector('.books-grid');
    var wrapper = document.querySelector('.main-content');
    var spinner = document.getElementById('books-loading');
    var clearBtn = document.getElementById('clear-filters');
    var filterContainer = document.getElementById('sidebar-filters');
    var searchInput = document.getElementById('live-search');
    if (!grid || !wrapper || !spinner) return;

    var loading = false;
    var MIN_VISIBLE = 20;
    var searchTerm = '';

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
        loadMore(function() { applyFilters(false); });
      }
    });

    // --- Filter Logic ---
    function getActiveFilters() {
      var filters = {};
      if (!filterContainer) return filters;
      var checked = filterContainer.querySelectorAll('input[type="checkbox"]:checked');
      checked.forEach(function(cb) {
        var type = cb.dataset.filterType;
        var val = cb.dataset.filterValue;
        if (!filters[type]) filters[type] = [];
        filters[type].push(val);
      });
      return filters;
    }

    function bookMatchesFilters(cover, filters) {
      for (var type in filters) {
        var values = filters[type];
        if (!values.length) continue;

        if (type === 'rating') {
          var bookRating = parseFloat(cover.dataset.rating);
          if (!bookRating && bookRating !== 0) return false;
          var matches = false;
          for (var i = 0; i < values.length; i++) {
            var starVal = parseInt(values[i]);
            if (Math.round(bookRating) >= starVal) { matches = true; break; }
          }
          if (!matches) return false;

        } else if (type === 'pubdate') {
          var pubdate = cover.dataset.pubdate;
          if (!pubdate) return false;
          var pubYear = new Date(pubdate).getFullYear();
          var currentYear = new Date().getFullYear();
          var age = currentYear - pubYear;
          var matches = false;
          for (var i = 0; i < values.length; i++) {
            var rangeVal = parseInt(values[i]);
            if (rangeVal === 2 && age <= 2) { matches = true; break; }
            if (rangeVal === 5 && age > 2 && age <= 5) { matches = true; break; }
            if (rangeVal === 10 && age > 5 && age <= 10) { matches = true; break; }
            if (rangeVal === 20 && age > 10 && age <= 20) { matches = true; break; }
            if (rangeVal === 999 && age > 20) { matches = true; break; }
          }
          if (!matches) return false;

        } else if (type === 'author') {
          var bookAuthors = (cover.dataset.author || '').split(', ').map(function(s) { return s.trim(); });
          var matches = false;
          for (var i = 0; i < values.length; i++) {
            if (bookAuthors.indexOf(values[i]) !== -1) { matches = true; break; }
          }
          if (!matches) return false;

        } else {
          // tags, languages, series, publishers — stored with || separator
          var attrName = type;
          var bookValues = (cover.dataset[attrName] || '').split('||').map(function(s) { return s.trim(); }).filter(Boolean);
          var matches = false;
          for (var i = 0; i < values.length; i++) {
            if (bookValues.indexOf(values[i]) !== -1) { matches = true; break; }
          }
          if (!matches) return false;
        }
      }
      return true;
    }

    function bookMatchesSearch(cover) {
      if (!searchTerm) return true;
      var title = (cover.dataset.title || '').toLowerCase();
      var author = (cover.dataset.author || '').toLowerCase();
      var tags = (cover.dataset.tags || '').toLowerCase();
      var series = (cover.dataset.series || '').toLowerCase();
      return title.indexOf(searchTerm) !== -1
          || author.indexOf(searchTerm) !== -1
          || tags.indexOf(searchTerm) !== -1
          || series.indexOf(searchTerm) !== -1;
    }

    var ANIM_DURATION = 250;
    var animating = false;

    function applyFilters(autoLoad) {
      var filters = getActiveFilters();
      var hasFilters = Object.keys(filters).length > 0;
      var hasSearch = searchTerm.length > 0;
      var isFiltering = hasFilters || hasSearch;
      if (clearBtn) clearBtn.style.display = hasFilters ? '' : 'none';

      var covers = Array.from(grid.querySelectorAll('.book-cover'));

      // FLIP step 1: record current positions of all visible covers
      var firstPositions = {};
      covers.forEach(function(cover) {
        if (cover.style.display !== 'none' && !cover.classList.contains('filter-hiding')) {
          var rect = cover.getBoundingClientRect();
          firstPositions[cover.dataset.bookId] = { x: rect.left, y: rect.top };
        }
      });

      // Determine which should be visible vs hidden
      var toShow = [];
      var toHide = [];
      var visibleCount = 0;

      covers.forEach(function(cover) {
        var matchesCheckbox = !hasFilters || bookMatchesFilters(cover, filters);
        var matchesSearch = bookMatchesSearch(cover);
        var wasHidden = cover.style.display === 'none' || cover.classList.contains('filter-hiding');

        if (matchesCheckbox && matchesSearch) {
          visibleCount++;
          if (wasHidden) toShow.push(cover);
        } else {
          if (!wasHidden) toHide.push(cover);
        }
      });

      // If no changes or currently mid-animation, apply instantly
      if (animating || (toShow.length === 0 && toHide.length === 0)) {
        covers.forEach(function(cover) {
          var matchesCheckbox = !hasFilters || bookMatchesFilters(cover, filters);
          var matchesSearch = bookMatchesSearch(cover);
          cover.style.display = (matchesCheckbox && matchesSearch) ? '' : 'none';
          cover.classList.remove('filter-hiding', 'filter-showing');
          cover.style.transform = '';
        });
        if (autoLoad !== false && isFiltering && visibleCount < MIN_VISIBLE && grid.dataset.nextUrl) {
          loadMore(function(loaded) { if (loaded) applyFilters(true); });
        }
        return;
      }

      animating = true;

      // Animate out: fade + shrink
      toHide.forEach(function(cover) {
        cover.classList.add('filter-hiding');
      });

      // After fade-out completes, remove from flow and animate remaining into new positions
      setTimeout(function() {
        // Remove hidden items from flow
        toHide.forEach(function(cover) {
          cover.style.display = 'none';
          cover.classList.remove('filter-hiding');
        });

        // Show new items (initially invisible for fade-in)
        toShow.forEach(function(cover) {
          cover.style.display = '';
          cover.classList.add('filter-showing');
        });

        // FLIP step 2: record new positions
        var lastPositions = {};
        covers.forEach(function(cover) {
          if (cover.style.display !== 'none') {
            var rect = cover.getBoundingClientRect();
            lastPositions[cover.dataset.bookId] = { x: rect.left, y: rect.top };
          }
        });

        // FLIP step 3: invert — apply transform from old position
        covers.forEach(function(cover) {
          if (cover.style.display === 'none') return;
          var id = cover.dataset.bookId;
          var first = firstPositions[id];
          var last = lastPositions[id];
          if (first && last && (first.x !== last.x || first.y !== last.y)) {
            var dx = first.x - last.x;
            var dy = first.y - last.y;
            cover.style.transition = 'none';
            cover.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
          }
        });

        // Force reflow so the inverse transforms are applied before animating
        void grid.offsetHeight;

        // FLIP step 4: play — animate to final position
        covers.forEach(function(cover) {
          if (cover.style.display === 'none') return;
          cover.style.transition = 'transform ' + ANIM_DURATION + 'ms ease, opacity ' + ANIM_DURATION + 'ms ease';
          cover.style.transform = '';
        });

        // Clean up after animation
        setTimeout(function() {
          covers.forEach(function(cover) {
            cover.style.transition = '';
            cover.style.transform = '';
            cover.classList.remove('filter-showing');
          });
          animating = false;

          // Auto-load more if too few visible
          if (autoLoad !== false && isFiltering && visibleCount < MIN_VISIBLE && grid.dataset.nextUrl) {
            loadMore(function(loaded) { if (loaded) applyFilters(true); });
          }
        }, ANIM_DURATION);

      }, ANIM_DURATION);
    }

    // Listen for checkbox changes
    if (filterContainer) {
      filterContainer.addEventListener('change', function(e) {
        if (e.target.matches('input[type="checkbox"]')) {
          applyFilters(true);
        }
      });
    }

    // Live search
    if (searchInput) {
      var searchTimer;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function() {
          searchTerm = searchInput.value.trim().toLowerCase();
          applyFilters(true);
        }, 150);
      });
    }

    // Clear filters button
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (filterContainer) {
          filterContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(function(cb) {
            cb.checked = false;
          });
        }
        if (searchInput) { searchInput.value = ''; searchTerm = ''; }
        applyFilters(false);
      });
    }
  })();


  // --- Sort Handler (AJAX, no page reload) ---
  (function() {
    var sortDropdown = document.querySelector('.sort-dropdown');
    var sortPopover = document.querySelector('.sort-popover');
    if (!sortDropdown || !sortPopover) return;

    var grid = document.querySelector('.books-grid');
    var spinner = document.getElementById('books-loading');
    var currentSort = sortDropdown.dataset.currentSort || 'new';

    var sortLabels = {
      abc: 'Title: A\u2013Z', zyx: 'Title: Z\u2013A',
      authaz: 'Author: A\u2013Z', authza: 'Author: Z\u2013A',
      pubold: 'Published: Old to New', pubnew: 'Published: New to Old',
      'new': 'Added: New to Old', old: 'Added: Old to New'
    };

    // Hide the currently active sort option on load
    function updateActiveOption() {
      sortPopover.querySelectorAll('.sort-option').forEach(function(btn) {
        btn.style.display = btn.dataset.sort === currentSort ? 'none' : '';
      });
    }
    updateActiveOption();

    // Build sort URL from the current next-url or page URL
    function buildSortUrl(sortParam) {
      var nextUrl = grid.dataset.nextUrl;
      if (nextUrl) {
        // next-url format: /pageType/sortParam/bookId/pageNum
        var parts = nextUrl.split('/').filter(Boolean);
        // parts[0]=pageType, parts[1]=sortParam, parts[2]=bookId, parts[3]=pageNum
        parts[1] = sortParam;
        parts[3] = '1'; // reset to page 1
        return '/' + parts.join('/');
      }
      // Fallback: use current page URL
      var path = window.location.pathname.split('/').filter(Boolean);
      if (path.length >= 2) {
        path[1] = sortParam;
        if (path.length >= 4) path[3] = '1';
        return '/' + path.join('/');
      }
      return window.location.pathname;
    }

    sortPopover.addEventListener('click', function(e) {
      var btn = e.target.closest('.sort-option');
      if (!btn) return;

      var newSort = btn.dataset.sort;
      if (newSort === currentSort) return;

      // Close the dropdown
      sortDropdown.removeAttribute('open');

      // Update button label
      sortDropdown.querySelector('.sort-button').textContent = sortLabels[newSort] || 'Sort';

      // Show loading
      if (spinner) spinner.style.display = 'flex';

      // Fetch sorted page via AJAX
      var url = buildSortUrl(newSort);
      fetch(url)
        .then(function(r) { return r.text(); })
        .then(function(html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var newGrid = doc.querySelector('.books-grid');
          if (!newGrid) return;

          // Fade out current content
          grid.style.transition = 'opacity 0.15s ease';
          grid.style.opacity = '0';

          setTimeout(function() {
            // Replace grid content
            grid.innerHTML = newGrid.innerHTML;

            // Update next-url for infinite scroll
            var newNext = newGrid.dataset.nextUrl;
            if (newNext) {
              grid.dataset.nextUrl = newNext;
            } else {
              delete grid.dataset.nextUrl;
            }

            // Apply saved cover size
            var saved = localStorage.getItem('coverSize');
            if (saved) {
              grid.style.setProperty('--cover-size', saved + 'px');
            }

            // Fade in new content
            grid.style.opacity = '1';
            setTimeout(function() { grid.style.transition = ''; }, 150);

            if (spinner) spinner.style.display = 'none';
          }, 150);
        })
        .catch(function() {
          grid.style.opacity = '1';
          grid.style.transition = '';
          if (spinner) spinner.style.display = 'none';
        });

      // Update state
      currentSort = newSort;
      sortDropdown.dataset.currentSort = newSort;
      updateActiveOption();
    });
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

    // Event delegation — works for covers loaded by infinite scroll too
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


  // --- Upload ---
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


  // --- Cover Size Slider ---
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


  // --- Keyboard shortcut: "/" to focus search ---
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
