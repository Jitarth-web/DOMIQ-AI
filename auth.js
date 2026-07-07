import apiClient from './api/index.js';

/**
 * auth.js
 * Frontend Auth Manager for DomIQ AI
 * Enterprise Email + Password Authentication with HttpOnly Cookies & Refresh Token Rotation
 */

const auth = {
  currentUser: null,
  backendUrl: apiClient.baseUrl,

  init: async function() {
    await this.verifySession();
  },

  /**
   * Universal fetch helper supporting HttpOnly credentials and automatic token refresh retry
   * Maintained as delegate to apiClient for backwards compatibility.
   */
  fetchWithAuth: async function(url, options = {}) {
    return apiClient.request(url, options);
  },


  verifySession: async function() {
    try {
      const data = await apiClient.get('/api/auth/me');
      if (data && data.success && data.user) {
        this.currentUser = data.user;
        this.updateUI();
        if (window.projects && typeof projects.loadUserProjects === 'function') {
          projects.loadUserProjects();
        }
        if (window.router) {
          if (window.location.pathname === '/' || window.location.pathname === '/login') {
            window.router.navigate('/dashboard');
          } else {
            window.router.navigate(window.location.pathname);
          }
        } else if (window.app && typeof app.openDashboard === 'function') {
          app.openDashboard();
        }
        return true;
      }
    } catch (err) {
      console.warn('[AUTH] Offline or session verification failed:', err.message);
    }
    this.currentUser = null;
    this.updateUI();
    return false;
  },

  openModal: function(mode = 'login') {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    this.switchTab(mode);
    this.clearError();
    this.clearSuccess();
    modal.classList.add('active');
  },

  closeModal: function() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    if (window.router && window.router.currentPath === '/login') {
      window.router.navigate('/');
    }
  },

  switchTab: function(mode) {
    const loginTab = document.getElementById('auth-tab-login');
    const signupTab = document.getElementById('auth-tab-signup');
    const forgotTab = document.getElementById('auth-tab-forgot');
    
    const loginForm = document.getElementById('auth-form-login');
    const signupForm = document.getElementById('auth-form-signup');
    const forgotForm = document.getElementById('auth-form-forgot');
    const resetForm = document.getElementById('auth-form-reset');

    const modalTitle = document.getElementById('auth-modal-title');
    const heroTop = document.getElementById('funky-hero-top');
    const heroBottom = document.getElementById('funky-hero-bottom');
    const heroTag = document.getElementById('funky-hero-tag');

    this.clearError();
    this.clearSuccess();

    [loginTab, signupTab, forgotTab].forEach(t => t && t.classList.remove('active'));
    [loginForm, signupForm, forgotForm, resetForm].forEach(f => f && (f.style.display = 'none'));

    if (mode === 'signup') {
      if (signupTab) signupTab.classList.add('active');
      if (signupForm) signupForm.style.display = 'flex';
      if (modalTitle) modalTitle.textContent = 'CREATE ACCOUNT';
      if (heroTop) heroTop.textContent = 'START';
      if (heroBottom) heroBottom.textContent = 'BUILDING';
      if (heroTag) heroTag.textContent = 'BUILD 2026';
    } else if (mode === 'forgot') {
      if (forgotTab) forgotTab.classList.add('active');
      if (forgotForm) forgotForm.style.display = 'flex';
      if (modalTitle) modalTitle.textContent = 'PASSWORD RECOVERY';
      if (heroTop) heroTop.textContent = 'RESET';
      if (heroBottom) heroBottom.textContent = 'ACCESS';
      if (heroTag) heroTag.textContent = 'RECOVERY';
    } else if (mode === 'reset') {
      if (resetForm) resetForm.style.display = 'flex';
      if (modalTitle) modalTitle.textContent = 'SET NEW PASSWORD';
      if (heroTop) heroTop.textContent = 'VERIFY';
      if (heroBottom) heroBottom.textContent = 'SECURITY';
      if (heroTag) heroTag.textContent = 'TOKEN VERIFY';
    } else {
      if (loginTab) loginTab.classList.add('active');
      if (loginForm) loginForm.style.display = 'flex';
      if (modalTitle) modalTitle.textContent = 'SIGN IN TO SYSTEM';
      if (heroTop) heroTop.textContent = 'ENGINE';
      if (heroBottom) heroBottom.textContent = 'FEATURES';
      if (heroTag) heroTag.textContent = 'SYSTEM ACTIVE';
    }
  },

  showError: function(msg) {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) {
      errBox.textContent = msg;
      errBox.style.display = 'block';
    }
  },

  clearError: function() {
    const errBox = document.getElementById('auth-error-msg');
    if (errBox) {
      errBox.textContent = '';
      errBox.style.display = 'none';
    }
  },

  showSuccess: function(msg) {
    const successBox = document.getElementById('auth-success-msg');
    if (successBox) {
      successBox.textContent = msg;
      successBox.style.display = 'block';
    }
  },

  clearSuccess: function() {
    const successBox = document.getElementById('auth-success-msg');
    if (successBox) {
      successBox.textContent = '';
      successBox.style.display = 'none';
    }
  },

  handleLoginSubmit: async function(event) {
    event.preventDefault();
    this.clearError();
    this.clearSuccess();

    const email = document.getElementById('auth-login-email').value.trim();
    const password = document.getElementById('auth-login-password').value;

    if (!email || !password) {
      this.showError('Please enter your email and password.');
      return;
    }

    const btn = document.getElementById('btn-auth-login-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Signing In...</span>';
    }

    try {
      const data = await apiClient.post('/api/auth/login', { email, password });

      if (!data || !data.success) {
        throw new Error(data.message || 'Login failed.');
      }

      this.currentUser = data.user;
      this.closeModal();
      this.updateUI();

      if (window.projects && typeof projects.loadUserProjects === 'function') {
        await projects.loadUserProjects();
      }

      if (window.editor) {
        editor.showToast(`✨ Welcome back, ${data.user.fullName}!`);
      }

      app.openDashboard();
    } catch (err) {
      this.showError(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Sign In</span>';
      }
    }
  },

  handleSignupSubmit: async function(event) {
    event.preventDefault();
    this.clearError();
    this.clearSuccess();

    const fullName = document.getElementById('auth-signup-fullname').value.trim();
    const email = document.getElementById('auth-signup-email').value.trim();
    const password = document.getElementById('auth-signup-password').value;
    const confirmPassword = document.getElementById('auth-signup-confirm').value;

    if (!fullName || !email || !password) {
      this.showError('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      this.showError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      this.showError('Passwords do not match.');
      return;
    }

    const btn = document.getElementById('btn-auth-signup-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>Creating Account...</span>';
    }

    try {
      const data = await apiClient.post('/api/auth/signup', { fullName, email, password, confirmPassword });

      if (!data || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      this.currentUser = data.user;
      this.closeModal();
      this.updateUI();

      if (window.projects && typeof projects.loadUserProjects === 'function') {
        await projects.loadUserProjects();
      }

      if (window.editor) {
        editor.showToast(`🎉 Account created! Welcome, ${data.user.fullName}`);
      }

      app.openDashboard();
    } catch (err) {
      this.showError(err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Create Account</span>';
      }
    }
  },

  handleForgotSubmit: async function(event) {
    event.preventDefault();
    this.clearError();
    this.clearSuccess();

    const email = document.getElementById('auth-forgot-email').value.trim();
    if (!email) {
      this.showError('Please enter your registered email address.');
      return;
    }

    try {
      const data = await apiClient.post('/api/auth/forgot-password', { email });

      if (!data || !data.success) {
        throw new Error(data.message || 'Password reset request failed.');
      }

      this.showSuccess(data.message);
      if (data.resetToken) {
        // Automatically pre-fill token input field for easy dev testing
        const tokenInput = document.getElementById('auth-reset-token');
        if (tokenInput) tokenInput.value = data.resetToken;
        setTimeout(() => this.switchTab('reset'), 1500);
      }
    } catch (err) {
      this.showError(err.message);
    }
  },

  handleResetSubmit: async function(event) {
    event.preventDefault();
    this.clearError();
    this.clearSuccess();

    const token = document.getElementById('auth-reset-token').value.trim();
    const newPassword = document.getElementById('auth-reset-password').value;
    const confirmPassword = document.getElementById('auth-reset-confirm').value;

    if (!token || !newPassword) {
      this.showError('Token and new password are required.');
      return;
    }

    if (newPassword.length < 8) {
      this.showError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.showError('Passwords do not match.');
      return;
    }

    try {
      const data = await apiClient.post('/api/auth/reset-password', { token, newPassword, confirmPassword });
      if (!data || !data.success) {
        throw new Error(data.message || 'Password reset failed.');
      }

      this.showSuccess(data.message);
      setTimeout(() => this.switchTab('login'), 1500);
    } catch (err) {
      this.showError(err.message);
    }
  },

  logout: async function() {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (e) {
      console.warn('Logout server request error:', e);
    }

    this.currentUser = null;

    if (window.projects) {
      projects.activeProject = null;
    }

    if (window.editor) {
      editor.showToast('Logged out successfully.');
    }

    this.updateUI();
    app.openLandingPage();
  },

  openProfileMenu: function() {
    if (!this.currentUser) {
      this.openModal('login');
      return;
    }
    const menu = document.getElementById('user-profile-dropdown');
    if (menu) {
      menu.classList.toggle('active');
    }
  },

  updateUI: function() {
    const userBadges = document.querySelectorAll('.user-avatar-badge');
    const welcomeName = document.querySelector('.dashboard-welcome h2');
    const headerActions = document.querySelectorAll('.header-actions');

    let initials = '🔑';
    let name = 'Sign In';
    let email = '';

    if (this.currentUser) {
      name = this.currentUser.fullName || this.currentUser.email.split('@')[0];
      email = this.currentUser.email;
      const parts = name.split(' ');
      initials = parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase();

      if (welcomeName) {
        welcomeName.innerHTML = `Welcome back, <span class="gradient-text font-outfit" style="text-transform: capitalize;">${name}</span>`;
      }
    } else {
      if (welcomeName) {
        welcomeName.innerHTML = `Welcome to <span class="gradient-text font-outfit">DomIQ AI</span>`;
      }
    }

    // Update avatar badges
    userBadges.forEach(badge => {
      badge.innerHTML = `<span>${initials}</span>`;
      badge.title = this.currentUser ? `Logged in as ${name} (${email})` : 'Sign In / Register';
      badge.onclick = (e) => {
        e.stopPropagation();
        this.openProfileMenu();
      };
    });

    // Update Dropdown Details
    const dropName = document.getElementById('profile-dropdown-name');
    const dropEmail = document.getElementById('profile-dropdown-email');
    if (dropName) dropName.textContent = this.currentUser ? name : 'Guest User';
    if (dropEmail) dropEmail.textContent = this.currentUser ? email : 'Not signed in';

    // Toggle Landing Header Login vs User Profile button
    headerActions.forEach(actionGroup => {
      const loginBtn = actionGroup.querySelector('.btn-login-trigger');
      const profileBadge = actionGroup.querySelector('.user-avatar-badge');
      if (loginBtn) {
        loginBtn.style.display = this.currentUser ? 'none' : 'inline-flex';
      }
      if (profileBadge) {
        profileBadge.style.display = 'flex';
      }
    });
  }
};

window.auth = auth;

// Close dropdown on click outside
document.addEventListener('click', (e) => {
  const menu = document.getElementById('user-profile-dropdown');
  if (menu && !menu.contains(e.target) && !e.target.closest('.user-avatar-badge')) {
    menu.classList.remove('active');
  }
});

document.addEventListener('DOMContentLoaded', () => auth.init());
