(function() {
  var csrfToken = document.querySelector('input[name="csrf_token"]').value;

  // Description read more/less
  var desc = document.getElementById('book-description');
  var toggleBtn = document.getElementById('description-toggle');
  if (desc && toggleBtn) {
    if (desc.scrollHeight > desc.clientHeight) {
      toggleBtn.style.display = '';
      desc.classList.add('truncated');
    }
    toggleBtn.addEventListener('click', function() {
      var expanded = desc.classList.toggle('expanded');
      toggleBtn.textContent = expanded ? 'Read less' : 'Read more';
    });
  }

  // Toggle read/unread
  var readBtn = document.getElementById('toggle-read-btn');
  if (readBtn) {
    readBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var url = readBtn.getAttribute('data-href');
      var isRead = readBtn.getAttribute('data-read') === 'true';

      fetch(url, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
      }).then(function(res) {
        if (!res.ok) throw new Error('Failed');
        var newRead = !isRead;
        readBtn.setAttribute('data-read', newRead ? 'true' : 'false');
        if (newRead) {
          readBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 256 256"><path d="M208,24H72A32,32,0,0,0,40,56V224a8,8,0,0,0,8,8H192a8,8,0,0,0,0-16H56a16,16,0,0,1,16-16H208a8,8,0,0,0,8-8V32A8,8,0,0,0,208,24Zm-8,160H72a31.82,31.82,0,0,0-16,4.29V56A16,16,0,0,1,72,40H200Z"></path></svg><span>Mark As Unread</span>';
        } else {
          readBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 256 256"><path d="M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z"></path></svg><span>Mark As Read</span>';
        }
      }).catch(function() {
        console.error('Failed to toggle read status');
      });
    });
  }

  // Shelf add
  var addContainer = document.getElementById('add-to-shelves');
  if (addContainer) {
    addContainer.addEventListener('click', function(e) {
      var link = e.target.closest('[data-shelf-action="add"]');
      if (!link) return;
      e.preventDefault();

      var url = link.getAttribute('data-href');
      var formData = new FormData();
      formData.append('csrf_token', csrfToken);

      fetch(url, {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      }).then(function(res) {
        if (!res.ok) throw new Error('Failed');
        var shelfName = link.textContent.trim();
        var shelfId = url.match(/\/shelf\/add\/(\d+)/)[1];
        link.remove();

        var shelvesContainer = document.getElementById('book-detail-shelves');
        var tag = document.createElement('span');
        tag.className = 'book-detail-shelf-tag';
        var tagLink = document.createElement('a');
        tagLink.href = '/books?shelf=' + shelfId;
        tagLink.textContent = shelfName;
        var removeBtn = document.createElement('button');
        removeBtn.className = 'book-detail-shelf-remove';
        removeBtn.setAttribute('data-href', url.replace('/add/', '/remove/'));
        removeBtn.setAttribute('data-shelf-name', shelfName);
        removeBtn.innerHTML = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 256 256"><path d="M168.49,104.49,145,128l23.52,23.51a12,12,0,0,1-17,17L128,145l-23.51,23.52a12,12,0,0,1-17-17L111,128,87.51,104.49a12,12,0,0,1,17-17L128,111l23.51-23.52a12,12,0,0,1,17,17ZM236,128A108,108,0,1,1,128,20,108.12,108.12,0,0,1,236,128Zm-24,0a84,84,0,1,0-84,84A84.09,84.09,0,0,0,212,128Z"></path></svg>';
        tag.appendChild(tagLink);
        tag.appendChild(removeBtn);
        shelvesContainer.insertBefore(tag, shelvesContainer.querySelector('.shelf-add-dropdown'));
        document.getElementById('shelf-actions').removeAttribute('open');
      }).catch(function() {
        console.error('Failed to add to shelf');
      });
    });
  }

  // Shelf remove (x button on shelf tags)
  var shelvesContainer = document.getElementById('book-detail-shelves');
  if (shelvesContainer) {
    shelvesContainer.addEventListener('click', function(e) {
      var btn = e.target.closest('.book-detail-shelf-remove');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();

      var shelfName = btn.getAttribute('data-shelf-name');
      var dialog = document.getElementById('remove-shelf-dialog');
      var heading = document.getElementById('remove-shelf-heading');
      var confirmBtn = document.getElementById('remove-shelf-confirm');
      var cancelBtn = document.getElementById('remove-shelf-cancel');

      heading.textContent = 'Remove Book from "' + shelfName + '"?';
      dialog.style.display = '';

      function closeDialog() {
        dialog.style.display = 'none';
      }

      cancelBtn.onclick = closeDialog;
      dialog.querySelector('.dialog-close').onclick = closeDialog;
      dialog.onclick = function(ev) { if (ev.target === dialog) closeDialog(); };

      confirmBtn.onclick = function() {
        closeDialog();
        var url = btn.getAttribute('data-href');
        var formData = new FormData();
        formData.append('csrf_token', csrfToken);

        fetch(url, {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: formData
        }).then(function(res) {
          if (!res.ok) throw new Error('Failed');
          var shelfTag = btn.closest('.book-detail-shelf-tag');
          var addUrl = url.replace('/remove/', '/add/');
          var newLink = document.createElement('a');
          newLink.setAttribute('data-href', addUrl);
          newLink.setAttribute('data-shelf-action', 'add');
          newLink.className = 'detail-action-popover-item';
          newLink.textContent = shelfName;
          var listView = document.getElementById('shelf-list-view');
          var showBtn = document.getElementById('show-create-shelf');
          listView.insertBefore(newLink, showBtn);
          shelfTag.remove();
        }).catch(function() {
          console.error('Failed to remove from shelf');
        });
      };
    });
  }

  // Close shelf popover on click outside and reset create form
  var shelfDropdown = document.getElementById('shelf-actions');
  var listView = document.getElementById('shelf-list-view');
  var createForm = document.getElementById('create-shelf-form');
  var showCreateBtn = document.getElementById('show-create-shelf');
  var createInput = document.getElementById('new-shelf-name');
  var createPublic = document.getElementById('new-shelf-public');
  var createKobo = document.getElementById('new-shelf-kobo');
  var createSubmit = document.getElementById('create-shelf-submit');
  var createError = document.getElementById('create-shelf-error');

  function resetCreateForm() {
    createForm.style.display = 'none';
    listView.style.display = '';
    createInput.value = '';
    if (createError) createError.textContent = '';
    if (createPublic) createPublic.checked = false;
    if (createKobo) createKobo.checked = false;
  }

  if (shelfDropdown) {
    document.addEventListener('click', function(e) {
      if (!shelfDropdown.contains(e.target)) {
        shelfDropdown.removeAttribute('open');
        resetCreateForm();
      }
    });
  }

  // Toggle to create form
  if (showCreateBtn && createForm) {
    showCreateBtn.addEventListener('click', function(e) {
      e.preventDefault();
      listView.style.display = 'none';
      createForm.style.display = '';
      createInput.focus();
    });

    createSubmit.addEventListener('click', function() {
      var name = createInput.value.trim();
      if (!name) return;

      var formData = new FormData();
      formData.append('csrf_token', csrfToken);
      formData.append('title', name);
      if (createPublic && createPublic.checked) formData.append('is_public', 'on');
      if (createKobo && createKobo.checked) formData.append('kobo_sync', 'on');

      fetch('/shelf/ajax-create', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        body: formData
      }).then(function(res) {
        return res.json().then(function(data) {
          if (!res.ok || data.error) {
            if (createError) createError.textContent = data.error || 'Failed to create shelf';
            return;
          }

          var bookId = window.location.pathname.match(/\/book\/(\d+)/)[1];
          var newLink = document.createElement('a');
          newLink.setAttribute('data-href', '/shelf/add/' + data.id + '/' + bookId);
          newLink.setAttribute('data-shelf-action', 'add');
          newLink.className = 'detail-action-popover-item';
          newLink.textContent = name;
          listView.insertBefore(newLink, showCreateBtn);

          resetCreateForm();
        });
      }).catch(function() {
        console.error('Failed to create shelf');
      });
    });

    createInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') createSubmit.click();
    });

    createInput.addEventListener('input', function() {
      if (createError) createError.textContent = '';
    });
  }
})();
