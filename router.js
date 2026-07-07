class Router {
  constructor() {
    this.routes = {
      '/': () => this.showLanding(),
      '/login': () => this.showLogin(),
      '/dashboard': () => this.showDashboard(),
      '/editor': () => this.showEditor(),
      '/projects': () => this.showDashboard(),
      '/settings': () => this.showSettings()
    };
    
    this.currentPath = '/';
  }

  init() {
    // Intercept clicks on links
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link && link.href && link.origin === window.location.origin) {
        const path = link.pathname;
        if (this.routes[path]) {
          e.preventDefault();
          this.navigate(path);
        }
      }
    });

    // Listen to history popstate
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    // Handle initial redirect from sessionStorage (for SPA refreshes)
    const redirectPath = sessionStorage.getItem('redirect_path');
    if (redirectPath) {
      sessionStorage.removeItem('redirect_path');
      window.history.replaceState(null, '', redirectPath);
    }

    this.handleRoute(window.location.pathname);
  }

  navigate(path) {
    if (window.location.pathname === path) return;
    window.history.pushState(null, '', path);
    this.handleRoute(path);
  }

  async handleRoute(path) {
    // Strip trailing slash
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    this.currentPath = path;

    // Check auth guards for protected routes
    const isProtectedRoute = ['/dashboard', '/editor', '/projects', '/settings'].includes(path);
    if (isProtectedRoute) {
      // If auth session verification is still running or user is not logged in
      if (window.auth && auth.currentUser === null) {
        // Run verifySession if it hasn't completed or verify again
        const isLoggedIn = await auth.verifySession();
        if (!isLoggedIn) {
          // Redirect to login modal
          this.navigate('/login');
          return;
        }
      }
    }

    const handler = this.routes[path] || this.routes['/'];
    handler();
  }

  showLanding() {
    if (window.auth && typeof auth.closeModal === 'function') {
      auth.closeModal();
    }
    if (window.app && typeof app.openLandingPage === 'function') {
      app.switchView('landing-page');
      if (app.landingParticles) app.landingParticles.start();
      if (app.dashboardParticles) app.dashboardParticles.stop();
    }
  }

  showLogin() {
    this.showLanding();
    if (window.auth && typeof auth.openModal === 'function') {
      auth.openModal('login');
    }
  }

  showDashboard() {
    if (window.auth && typeof auth.closeModal === 'function') {
      auth.closeModal();
    }
    if (window.app && typeof app.openDashboard === 'function') {
      if (window.projects && typeof projects.refreshGrid === 'function') {
        projects.refreshGrid();
      }
      app.switchView('dashboard-page');
      if (app.landingParticles) app.landingParticles.stop();
      if (app.dashboardParticles) app.dashboardParticles.start();
    }
  }

  showEditor() {
    if (window.auth && typeof auth.closeModal === 'function') {
      auth.closeModal();
    }
    if (window.app && typeof app.openStudio === 'function') {
      app.switchView('studio-page');
      app.refreshStudioLayout();
      if (app.landingParticles) app.landingParticles.stop();
      if (app.dashboardParticles) app.dashboardParticles.stop();
    }
  }

  showSettings() {
    this.showEditor();
    if (window.app && typeof app.selectStudioTabById === 'function') {
      app.selectStudioTabById('settings');
    }
  }
}

window.router = new Router();
document.addEventListener('DOMContentLoaded', () => {
  window.router.init();
});
