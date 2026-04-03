(function() {
  var csrf = (document.querySelector('input[name="csrf_token"]') || {}).value || '';
  var Popovers = window.Popovers;
  var active = null;

  function open(el, rect) {
    close();
    Popovers.closeAll();
    el.style.position = 'fixed';
    el.style.top = (rect.bottom + 4) + 'px';
    el.style.left = rect.left + 'px';
    el.style.display = '';
    Popovers.showOverlay();
    active = el;
  }

  function close() {
    if (active) { active.style.display = 'none'; active = null; }
    Popovers.hideOverlay();
  }

  Popovers.register(close);

  function post(url, data, ok, fail) {
    var fd = new FormData();
    fd.append('csrf_token', csrf);
    for (var k in data) fd.append(k, data[k]);
    fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'XMLHttpRequest' }, body: fd })
      .then(function(r) {
        return r.json().then(function(j) { (!r.ok || j.error) ? fail(j.error || 'Failed') : ok(j); });
      }).catch(function() { fail('Failed'); });
  }

  // Show more / less
  document.querySelectorAll('.filter-show-more').forEach(function(btn) {
    var items = btn.closest('.filter-options').querySelectorAll('.filter-overflow');
    var on = false, n = items.length;
    btn.addEventListener('click', function() {
      on = !on;
      items.forEach(function(el) { el.style.display = on ? '' : 'none'; });
      btn.textContent = on ? 'Show less' : 'Show ' + n + ' more';
    });
  });

  // Shelf form
  var form = document.getElementById('sidebar-create-shelf-popover');
  if (!form) return;
  document.body.appendChild(form);

  var nameEl = form.querySelector('#sidebar-new-shelf-name');
  var pubEl = form.querySelector('#sidebar-new-shelf-public');
  var submitEl = form.querySelector('#sidebar-create-shelf-submit');
  var errorEl = form.querySelector('#sidebar-create-shelf-error');
  var headerEl = form.querySelector('.create-shelf-header');
  var createBtn = document.getElementById('sidebar-create-shelf-btn');

  function reset() {
    nameEl.value = '';
    if (pubEl) pubEl.checked = false;
    if (errorEl) errorEl.textContent = '';
    if (headerEl) headerEl.textContent = 'Create Shelf';
    submitEl.onclick = null;
  }

  nameEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitEl.click(); });
  nameEl.addEventListener('input', function() { if (errorEl) errorEl.textContent = ''; });

  function getFormData() {
    var d = { title: nameEl.value.trim() };
    if (pubEl && pubEl.checked) d.is_public = 'on';
    return d;
  }

  function showError(msg) { if (errorEl) errorEl.textContent = msg; }

  // Create
  if (createBtn) {
    createBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      reset();
      open(form, createBtn.getBoundingClientRect());
      nameEl.focus();
    });
  }

  submitEl.addEventListener('click', function() {
    var d = getFormData();
    if (!d.title) return;
    post('/shelf/ajax-create', d, function(r) {
      var c = document.querySelector('.filter-section .filter-options');
      if (c) {
        var l = document.createElement('label');
        l.innerHTML = '<input type="checkbox" data-filter-type="shelf" data-filter-id="' + r.id + '" data-filter-value="' + r.name + '"> ' + r.name;
        c.insertBefore(l, c.firstChild);
      }
      close();
    }, showError);
  });

  // Shelf menus
  document.querySelectorAll('.shelf-menu').forEach(function(menu) {
    var menuBtn = menu.querySelector('.shelf-menu-btn');
    var popover = menu.querySelector('.shelf-menu-popover');
    var item = menu.closest('.shelf-filter-item');
    var editBtn = popover.querySelector('.shelf-edit-btn');
    var delBtn = popover.querySelector('.shelf-delete-btn');
    document.body.appendChild(popover);

    menuBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      var r = menuBtn.getBoundingClientRect();
      open(popover, { bottom: r.bottom - 4, left: r.right - 120 });
    });

    if (editBtn) editBtn.addEventListener('click', function(e) {
      e.preventDefault(); e.stopPropagation();
      close();
      nameEl.value = editBtn.getAttribute('data-shelf-name');
      if (pubEl) pubEl.checked = editBtn.getAttribute('data-shelf-public') === '1';
      if (headerEl) headerEl.textContent = 'Edit Shelf';
      if (errorEl) errorEl.textContent = '';

      submitEl.onclick = function() {
        var d = getFormData();
        if (!d.title) return;
        post('/shelf/ajax-edit/' + editBtn.getAttribute('data-shelf-id'), d, function(r) {
          var label = item.querySelector('label');
          var cb = label.querySelector('input');
          label.textContent = '';
          label.appendChild(cb);
          label.appendChild(document.createTextNode(' ' + r.name));
          cb.setAttribute('data-filter-value', r.name);
          editBtn.setAttribute('data-shelf-name', r.name);
          close(); reset();
        }, showError);
      };

      open(form, menuBtn.getBoundingClientRect());
      nameEl.focus();
    });

    if (delBtn) delBtn.addEventListener('click', function(e) {
      e.preventDefault();
      close();
      var dialog = document.getElementById('delete-shelf-dialog');
      var heading = document.getElementById('delete-shelf-heading');
      var confirmBtn = document.getElementById('delete-shelf-confirm');
      var cancelBtn = document.getElementById('delete-shelf-cancel');
      if (!dialog) return;

      heading.textContent = 'Delete "' + delBtn.getAttribute('data-shelf-name') + '"?';
      dialog.style.display = '';

      function closeDialog() {
        dialog.style.display = 'none';
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
      }

      cancelBtn.onclick = closeDialog;
      dialog.querySelector('.dialog-close').onclick = closeDialog;
      dialog.onclick = function(ev) { if (ev.target === dialog) closeDialog(); };

      confirmBtn.onclick = function() {
        closeDialog();
        post(delBtn.getAttribute('data-href'), {}, function() { item.remove(); }, function(err) {
          console.error('Failed to delete shelf:', err);
        });
      };
    });
  });
})();
