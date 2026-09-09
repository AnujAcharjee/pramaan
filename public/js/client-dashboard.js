document.addEventListener('DOMContentLoaded', () => {
  const nameDisplay = document.getElementById('name-display');
  const nameInputWrapper = document.getElementById('name-input-wrapper');
  const editNameInput = document.getElementById('edit-name');

  const domainDisplay = document.getElementById('domain-display');
  const domainInputWrapper = document.getElementById('domain-input-wrapper');
  const editDomainInput = document.getElementById('edit-domain');

  const normalActions = document.getElementById('normal-actions');
  const editActions = document.getElementById('edit-actions');
  const editDetailsBtn = document.getElementById('edit-details-btn');
  const cancelDetailsBtn = document.getElementById('cancel-details-btn');
  const addRealDomainBtns = document.querySelectorAll('.add-real-domain-btn, .add-real-domain-link');

  const editDetailsForm = document.getElementById('edit-details-form');
  const saveBtn = document.getElementById('save-details-btn');
  const saveIcon = document.getElementById('save-btn-icon');
  const saveSpinner = document.getElementById('save-btn-spinner');
  const saveText = document.getElementById('save-btn-text');

  if (!editNameInput || !editDomainInput) return;

  const originalName = editNameInput.value;
  const originalDomain = editDomainInput.value;

  function setEditMode(isEditing, focusTarget) {
    if (isEditing) {
      // Hide static displays
      if (nameDisplay) nameDisplay.classList.add('hidden');
      if (domainDisplay) {
        domainDisplay.classList.remove('flex');
        domainDisplay.classList.add('hidden');
      }

      // Show input wrappers
      if (nameInputWrapper) {
        nameInputWrapper.classList.remove('hidden');
        nameInputWrapper.classList.add('block');
      }
      if (domainInputWrapper) {
        domainInputWrapper.classList.remove('hidden');
        domainInputWrapper.classList.add('flex');
      }

      // Toggle action buttons
      if (normalActions) {
        normalActions.classList.remove('flex');
        normalActions.classList.add('hidden');
      }
      if (editActions) {
        editActions.classList.remove('hidden');
        editActions.classList.add('flex');
      }

      // Focus appropriate input
      if (focusTarget === 'domain') {
        if (editDomainInput.value === 'localhost') {
          editDomainInput.value = '';
        }
        editDomainInput.focus();
        editDomainInput.select();
      } else {
        editNameInput.focus();
        editNameInput.select();
      }
    } else {
      // Show static displays
      if (nameDisplay) nameDisplay.classList.remove('hidden');
      if (domainDisplay) {
        domainDisplay.classList.remove('hidden');
        domainDisplay.classList.add('flex');
      }

      // Hide input wrappers
      if (nameInputWrapper) {
        nameInputWrapper.classList.add('hidden');
        nameInputWrapper.classList.remove('block');
      }
      if (domainInputWrapper) {
        domainInputWrapper.classList.add('hidden');
        domainInputWrapper.classList.remove('flex');
      }

      // Toggle action buttons
      if (normalActions) {
        normalActions.classList.remove('hidden');
        normalActions.classList.add('flex');
      }
      if (editActions) {
        editActions.classList.add('hidden');
        editActions.classList.remove('flex');
      }

      // Revert values
      editNameInput.value = originalName;
      editDomainInput.value = originalDomain;
    }
  }

  // Bind Edit button
  if (editDetailsBtn) {
    editDetailsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setEditMode(true, 'name');
    });
  }

  // Bind Cancel button
  if (cancelDetailsBtn) {
    cancelDetailsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setEditMode(false);
      // Clean query params from URL if present
      if (window.location.search.includes('edit=')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('edit');
        url.searchParams.delete('target');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    });
  }

  // Bind all "Add Real Domain" buttons/links
  addRealDomainBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      setEditMode(true, 'domain');
    });
  });

  // Handle ESC key to cancel edit mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nameInputWrapper && !nameInputWrapper.classList.contains('hidden')) {
      setEditMode(false);
    }
  });

  // Form submission loading state (matching account.ejs profile form)
  if (editDetailsForm && saveBtn) {
    editDetailsForm.addEventListener('submit', () => {
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-75', 'cursor-not-allowed');

      if (saveIcon) saveIcon.classList.add('hidden');
      if (saveSpinner) saveSpinner.classList.remove('hidden');
      if (saveText) saveText.textContent = 'Saving...';
    });
  }

  // Auto-focus if opened with ?target=domain via SSR
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('target') === 'domain' && editDomainInput) {
    if (editDomainInput.value === 'localhost') {
      editDomainInput.value = '';
    }
    editDomainInput.focus();
    editDomainInput.select();
  }
});
