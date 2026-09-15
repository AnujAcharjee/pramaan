document.addEventListener('DOMContentLoaded', () => {
  const avatarContainer = document.getElementById('avatar-container');
  const avatarInput = document.getElementById('avatar-input');
  const avatarPreview = document.getElementById('avatar-preview');
  const avatarEditOverlay = document.getElementById('avatar-edit-overlay');
  const dragOverlay = document.getElementById('drag-overlay');
  const undoBtn = document.getElementById('undo-avatar-btn');
  
  const nameDisplay = document.getElementById('name-display');
  const nameInputWrapper = document.getElementById('name-input-wrapper');
  const nameInput = document.getElementById('name-input');
  
  const editProfileBtn = document.getElementById('edit-profile-btn');
  const cancelProfileBtn = document.getElementById('cancel-profile-btn');
  const normalActions = document.getElementById('normal-actions');
  const editActions = document.getElementById('edit-actions');
  
  const profileForm = document.getElementById('profile-form');
  const saveBtn = document.getElementById('save-profile-btn');
  const saveIcon = document.getElementById('save-btn-icon');
  const saveSpinner = document.getElementById('save-btn-spinner');
  const saveText = document.getElementById('save-btn-text');

  if (!avatarInput || !avatarPreview) return;

  const originalAvatarUrl = avatarPreview.src;
  const originalName = nameInput ? nameInput.value : '';
  let previewObjectUrl = null;

  const triggerRemoveAvatarBtn = document.getElementById('trigger-remove-avatar-btn');
  const removeAvatarForm = document.getElementById('remove-avatar-form');
  const hasServerAvatar = avatarPreview ? avatarPreview.dataset.hasServerAvatar === 'true' : false;

  // Toggle Edit Mode
  function setEditMode(isEditing) {
    if (isEditing) {
      // Show edit inputs
      if (nameDisplay) nameDisplay.classList.add('hidden');
      if (nameInputWrapper) {
        nameInputWrapper.classList.remove('hidden');
        nameInputWrapper.classList.add('inline-block');
      }
      
      if (avatarEditOverlay) {
        avatarEditOverlay.classList.remove('hidden');
        avatarEditOverlay.classList.add('flex');
      }
      if (avatarInput) {
        avatarInput.classList.remove('hidden');
      }

      // Show edit actions
      if (normalActions) normalActions.classList.add('hidden');
      if (editActions) {
        editActions.classList.remove('hidden');
        editActions.classList.add('flex');
      }

      // Ensure remove button state matches
      if (triggerRemoveAvatarBtn) {
        const hasLocalFile = avatarInput.files && avatarInput.files.length > 0;
        if (hasServerAvatar || hasLocalFile) {
          triggerRemoveAvatarBtn.classList.remove('hidden');
          triggerRemoveAvatarBtn.classList.add('inline-flex');
        } else {
          triggerRemoveAvatarBtn.classList.add('hidden');
          triggerRemoveAvatarBtn.classList.remove('inline-flex');
        }
      }
    } else {
      // Hide edit inputs
      if (nameDisplay) nameDisplay.classList.remove('hidden');
      if (nameInputWrapper) {
        nameInputWrapper.classList.add('hidden');
        nameInputWrapper.classList.remove('inline-block');
      }
      
      if (avatarEditOverlay) {
        avatarEditOverlay.classList.add('hidden');
        avatarEditOverlay.classList.remove('flex');
      }
      if (avatarInput) {
        avatarInput.classList.add('hidden');
      }

      // Hide edit actions
      if (normalActions) normalActions.classList.remove('hidden');
      if (editActions) {
        editActions.classList.add('hidden');
        editActions.classList.remove('flex');
      }

      // Revert values
      avatarInput.value = '';
      if (nameInput) nameInput.value = originalName;
      
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }
      avatarPreview.src = originalAvatarUrl;

      if (undoBtn) {
        undoBtn.classList.add('hidden');
        undoBtn.classList.remove('inline-flex');
      }

      if (triggerRemoveAvatarBtn) {
        if (hasServerAvatar) {
          triggerRemoveAvatarBtn.classList.remove('hidden');
          triggerRemoveAvatarBtn.classList.add('inline-flex');
        } else {
          triggerRemoveAvatarBtn.classList.add('hidden');
          triggerRemoveAvatarBtn.classList.remove('inline-flex');
        }
      }
    }
  }

  if (editProfileBtn) {
    editProfileBtn.addEventListener('click', () => setEditMode(true));
  }

  if (cancelProfileBtn) {
    cancelProfileBtn.addEventListener('click', () => setEditMode(false));
  }

  // Function to check if there are any unsaved changes (to show/hide undo button)
  function checkChanges() {
    const nameChanged = nameInput ? nameInput.value !== originalName : false;
    const avatarChanged = avatarInput.files && avatarInput.files.length > 0;

    if (undoBtn) {
      if (nameChanged || avatarChanged) {
        undoBtn.classList.remove('hidden');
        undoBtn.classList.add('inline-flex');
      } else {
        undoBtn.classList.add('hidden');
        undoBtn.classList.remove('inline-flex');
      }
    }

    if (triggerRemoveAvatarBtn) {
      if (avatarChanged || hasServerAvatar) {
        triggerRemoveAvatarBtn.classList.remove('hidden');
        triggerRemoveAvatarBtn.classList.add('inline-flex');
      } else {
        triggerRemoveAvatarBtn.classList.add('hidden');
        triggerRemoveAvatarBtn.classList.remove('inline-flex');
      }
    }
  }

  // Function to update preview with a new file
  function handleFile(file) {
    if (!file) return;
    
    // Check if it's an image
    if (file.type && !file.type.startsWith('image/')) {
      console.warn('Selected file is not an image type:', file.type);
      return;
    }

    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
    }

    try {
      previewObjectUrl = URL.createObjectURL(file);
      
      // Smooth transition
      avatarPreview.style.opacity = '0';
      setTimeout(() => {
        avatarPreview.src = previewObjectUrl;
        avatarPreview.style.opacity = '1';
      }, 150);

      checkChanges();
    } catch (err) {
      console.error('Failed to create object URL or update preview:', err);
    }
  }

  // File input change
  avatarInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    } else {
      checkChanges();
    }
  });

  // Name input change
  if (nameInput) {
    nameInput.addEventListener('input', checkChanges);
  }

  // Drag & Drop event listeners
  if (avatarContainer && dragOverlay) {
    ['dragenter', 'dragover'].forEach(eventName => {
      avatarContainer.addEventListener(eventName, (e) => {
        // Only allow drag and drop when in editing mode
        if (avatarInput.classList.contains('hidden')) return;

        e.preventDefault();
        e.stopPropagation();
        dragOverlay.classList.remove('opacity-0');
        dragOverlay.classList.add('opacity-100');
      }, false);
    });

    ['dragleave', 'dragend', 'drop'].forEach(eventName => {
      avatarContainer.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragOverlay.classList.remove('opacity-100');
        dragOverlay.classList.add('opacity-0');
      }, false);
    });

    avatarContainer.addEventListener('drop', (e) => {
      if (avatarInput.classList.contains('hidden')) return;

      const dt = e.dataTransfer;
      const files = dt.files;

      if (files && files[0] && files[0].type.startsWith('image/')) {
        avatarInput.files = files;
        handleFile(files[0]);
      }
    }, false);
  }

  // Undo Button click
  if (undoBtn) {
    undoBtn.addEventListener('click', () => {
      avatarInput.value = '';
      if (nameInput) nameInput.value = originalName;

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }

      avatarPreview.style.opacity = '0';
      setTimeout(() => {
        avatarPreview.src = originalAvatarUrl;
        avatarPreview.style.opacity = '1';
      }, 150);

      undoBtn.classList.add('hidden');
      undoBtn.classList.remove('inline-flex');

      checkChanges();
    });
  }

  // Form Submission Loading State
  if (profileForm && saveBtn) {
    profileForm.addEventListener('submit', () => {
      saveBtn.disabled = true;
      saveBtn.classList.add('opacity-75', 'cursor-not-allowed');

      if (saveIcon) saveIcon.classList.add('hidden');
      if (saveSpinner) saveSpinner.classList.remove('hidden');
      if (saveText) saveText.textContent = 'Saving...';
    });
  }

  // Handle Avatar Removal
  function handleRemoveAvatar(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const hadLocalFile = Boolean(avatarInput.files && avatarInput.files.length > 0);

    if (hadLocalFile) {
      avatarInput.value = '';
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
        previewObjectUrl = null;
      }
      checkChanges();
    }

    if (hasServerAvatar) {
      if (confirm('Are you sure you want to remove your profile avatar?')) {
        if (removeAvatarForm) {
          removeAvatarForm.submit();
        }
      } else if (hadLocalFile) {
        avatarPreview.src = originalAvatarUrl;
      }
    } else {
      avatarPreview.src = '/images/default-avatar.png';
      if (triggerRemoveAvatarBtn) {
        triggerRemoveAvatarBtn.classList.add('hidden');
        triggerRemoveAvatarBtn.classList.remove('inline-flex');
      }
    }
  }

  if (triggerRemoveAvatarBtn) {
    triggerRemoveAvatarBtn.addEventListener('click', handleRemoveAvatar);
  }
});
