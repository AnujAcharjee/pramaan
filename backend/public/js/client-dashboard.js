function getDnsHostInfo(rawDomain) {
  if (!rawDomain) {
    return { host: '_pramaan-verification', subdomain: '', apex: '', fqdn: '_pramaan-verification' };
  }
  let domain = rawDomain.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//i, '');
  domain = domain.split('/')[0];
  domain = domain.split(':')[0];
  domain = domain.replace(/\.+$/, '');

  if (!domain || domain === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(domain)) {
    return {
      host: '_pramaan-verification',
      subdomain: '',
      apex: domain,
      fqdn: `_pramaan-verification.${domain}`,
    };
  }

  const parts = domain.split('.');
  if (parts.length <= 2) {
    return {
      host: '_pramaan-verification',
      subdomain: '',
      apex: domain,
      fqdn: `_pramaan-verification.${domain}`,
    };
  }

  const isMultiPartCctld = /\.(?:co|com|org|net|edu|gov|ac|biz|ne|or|gen|firm|ind|nic|res)\.[a-z]{2}$/i.test(domain);
  const apexPartsCount = isMultiPartCctld ? 3 : 2;

  if (parts.length <= apexPartsCount) {
    return {
      host: '_pramaan-verification',
      subdomain: '',
      apex: domain,
      fqdn: `_pramaan-verification.${domain}`,
    };
  }

  const subdomainParts = parts.slice(0, parts.length - apexPartsCount);
  const apexParts = parts.slice(parts.length - apexPartsCount);
  const subdomain = subdomainParts.join('.');
  const apex = apexParts.join('.');

  return {
    host: `_pramaan-verification.${subdomain}`,
    subdomain,
    apex,
    fqdn: `_pramaan-verification.${domain}`,
  };
}

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

  function updateDomainDnsHostPreview() {
    if (!editDomainInput) return;
    const val = editDomainInput.value;
    const dnsInfo = getDnsHostInfo(val);

    // Dynamic update for the DNS verification card if currently rendered
    const txtHostInput = document.getElementById('txt-host');
    if (txtHostInput) {
      txtHostInput.value = dnsInfo.host;
    }
  }

  editDomainInput.addEventListener('input', updateDomainDnsHostPreview);

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

      updateDomainDnsHostPreview();

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
      updateDomainDnsHostPreview();
    }
  }

  // Initialize preview on load
  updateDomainDnsHostPreview();

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

  // Client Avatar Upload & Remove Handling
  const avatarInput = document.getElementById('client-avatar-file-input');
  const avatarForm = document.getElementById('client-avatar-upload-form');
  const triggerRemoveAvatarBtn = document.getElementById('trigger-remove-avatar-btn');
  const removeAvatarForm = document.getElementById('client-remove-avatar-form');

  if (avatarInput && avatarForm) {
    avatarInput.addEventListener('change', () => {
      if (avatarInput.files && avatarInput.files.length > 0) {
        avatarForm.submit();
      }
    });
  }

  if (triggerRemoveAvatarBtn && removeAvatarForm) {
    triggerRemoveAvatarBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to remove the client logo?')) {
        removeAvatarForm.submit();
      }
    });
  }
});
