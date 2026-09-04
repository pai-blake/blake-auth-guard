/**
 * static/js/social.js
 * Social Authentication Module — Google Identity Services, GitHub & Discord OAuth 2.0
 */
(function () {
  'use strict';

  const GOOGLE_CLIENT_ID = '145228113570-rb5or7dkn8l4fidqaacr2irr9ge7u579.apps.googleusercontent.com';
  let tokenClient = null;

  console.log('[social.js] ✅ Script executing...');

  // ─── OAuth Callback Handler (For GitHub & Discord popup callbacks) ─────────
  async function handleUrlOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (!code) return;

    console.log('[social.js] Found OAuth callback parameters in URL. Code:', code, '| State:', state);
    
    // Clear URL parameters without reload
    const cleanUrl = window.location.origin + window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);

    try {
      // Resolve provider from state parameter (most reliable across popups)
      const provider = (state || sessionStorage.getItem('oauth_provider') || 'github').toLowerCase();
      sessionStorage.removeItem('oauth_provider');
      
      const endpoint = `/api/auth/${provider}`;
      const payload = {
        provider: provider,
        code: code,
        redirectUri: window.location.origin + '/'
      };
      const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
      toast(`Verifying ${providerName} authorization code...`, 'info', 3000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      console.log(`[social.js] ${providerName} OAuth verification result:`, data);

      if (window.opener && window.opener !== window) {
        // Send authenticated user details back to parent window and close popup
        window.opener.postMessage({ type: 'social_oauth_success', result: data, provider: providerName }, '*');
        window.close();
      } else {
        // Direct window redirect
        handleAuthResponse(data, providerName);
      }
    } catch (err) {
      console.error('[social.js] Error exchanging OAuth payload:', err);
      toast('Failed to verify authentication credentials.', 'error');
    }
  }

  // Listen for popup callback messages in main window
  window.addEventListener('message', (event) => {
    if (event.data && (event.data.type === 'github_oauth_success' || event.data.type === 'social_oauth_success')) {
      console.log('[social.js] Received postMessage from OAuth popup:', event.data.result);
      handleAuthResponse(event.data.result, event.data.provider || 'Social');
    }
  });

  // Run callback check immediately upon script load
  handleUrlOAuthCallback();

  // ─── Load GIS script dynamically & wait for oauth2 namespace ──────────
  function loadGIS() {
    return new Promise((resolve, reject) => {
      function isReady() {
        return !!(window.google && window.google.accounts && window.google.accounts.oauth2);
      }

      if (isReady()) {
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        clearInterval(pollId);
        reject(new Error('Google Sign-In SDK load timed out. Check ad-blockers or connection.'));
      }, 10000);

      const pollId = setInterval(() => {
        if (isReady()) {
          clearInterval(pollId);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 50);

      if (!document.querySelector('script[src*="gsi/client"]')) {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.onerror = () => {
          clearInterval(pollId);
          clearTimeout(timeoutId);
          reject(new Error('Failed to download Google SDK (Script blocked by extension or network).'));
        };
        document.head.appendChild(s);
      }
    });
  }

  // ─── Build Google token client ───────────────────────────────────────────────
  function buildTokenClient(clientId) {
    if (tokenClient) return tokenClient;
    console.log('[social.js] Building GIS token client...');

    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      throw new Error('Google Identity Services SDK is not initialized.');
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: onGoogleToken,
      error_callback: (err) => {
        console.error('[social.js] GIS error_callback:', err);
        toast('Google Sign-In failed: ' + (err.message || err.error || 'Cancelled'), 'error');
      }
    });
    console.log('[social.js] ✅ Google Token client ready');
    return tokenClient;
  }

  // ─── Handle Google token response ────────────────────────────────────────────
  async function onGoogleToken(resp) {
    console.log('[social.js] onGoogleToken called:', resp);
    if (!resp || !resp.access_token) {
      if (resp && resp.error && resp.error !== 'access_denied') {
        toast('Google Sign-In error: ' + resp.error, 'error');
      }
      return;
    }

    toast('Verifying your Google account...', 'info', 2500);

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          credential: resp.access_token,
          accessToken: resp.access_token,
          access_token: resp.access_token
        })
      });
      const data = await res.json();
      handleAuthResponse(data, 'Google');
    } catch (err) {
      console.error('[social.js] Backend fetch error:', err);
      toast('Network error verifying Google account. Please try again.', 'error');
    }
  }

  // ─── Main Google Sign-In trigger ─────────────────────────────────────────────
  async function triggerGoogleSignIn() {
    console.log('[social.js] triggerGoogleSignIn() called');
    toast('Connecting to Google...', 'info', 2000);

    try {
      await loadGIS();
      let clientId = GOOGLE_CLIENT_ID;
      try {
        const r = await fetch('/api/config/google');
        const d = await r.json();
        if (d && d.clientId) clientId = d.clientId.trim();
      } catch (e) {
        console.warn('[social.js] Could not fetch Google client ID from backend, using default');
      }

      const client = buildTokenClient(clientId);
      client.requestAccessToken({ prompt: 'select_account' });

    } catch (err) {
      console.error('[social.js] triggerGoogleSignIn error:', err);
      toast(err.message || 'Could not connect to Google.', 'error', 4000);
    }
  }

  // ─── Main GitHub Sign-In trigger ─────────────────────────────────────────────
  async function triggerGitHubSignIn() {
    console.log('[social.js] triggerGitHubSignIn() called');
    toast('Connecting to GitHub...', 'info', 2000);

    try {
      const r = await fetch('/api/config/github');
      const data = await r.json();

      if (data && data.hasClientId && data.clientId) {
        sessionStorage.setItem('oauth_provider', 'github');
        const clientId = data.clientId.trim();
        const redirectUri = encodeURIComponent(window.location.origin + '/');
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email&redirect_uri=${redirectUri}&state=github`;
        
        const width = 600, height = 700;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        window.open(githubAuthUrl, 'GitHubOAuth', `width=${width},height=${height},top=${top},left=${left}`);
        return;
      }

      // Demo Fallback
      const emailEl = document.getElementById('login-email');
      let userEmail = emailEl ? emailEl.value.trim().toLowerCase() : '';

      if (!userEmail) {
        const promptEmail = prompt('Enter your GitHub email address to sign in:');
        if (!promptEmail || !promptEmail.includes('@')) {
          toast('Please enter a valid GitHub email address to continue.', 'info');
          return;
        }
        userEmail = promptEmail.trim().toLowerCase();
      }

      toast('Authenticating with GitHub profile...', 'info', 2000);
      const name = userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const res = await window.DB.socialLogin('github', userEmail, name);
      handleAuthResponse(res, 'GitHub');

    } catch (err) {
      console.error('[social.js] GitHub auth error:', err);
      toast('GitHub Authentication error. Please try again.', 'error');
    }
  }

  // ─── Main Discord Sign-In trigger ─────────────────────────────────────────────
  async function triggerDiscordSignIn() {
    console.log('[social.js] triggerDiscordSignIn() called');
    toast('Connecting to Discord...', 'info', 2000);

    try {
      const r = await fetch('/api/config/discord');
      const data = await r.json();

      if (data && data.hasClientId && data.clientId) {
        sessionStorage.setItem('oauth_provider', 'discord');
        const clientId = data.clientId.trim();
        const redirectUri = encodeURIComponent(window.location.origin + '/');
        const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email&state=discord`;
        
        const width = 600, height = 750;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);
        window.open(discordAuthUrl, 'DiscordOAuth', `width=${width},height=${height},top=${top},left=${left}`);
        return;
      }

      // Demo Fallback
      const emailEl = document.getElementById('login-email');
      let userEmail = emailEl ? emailEl.value.trim().toLowerCase() : '';

      if (!userEmail) {
        const promptEmail = prompt('Enter your Discord email address to sign in:');
        if (!promptEmail || !promptEmail.includes('@')) {
          toast('Please enter a valid Discord email address to continue.', 'info');
          return;
        }
        userEmail = promptEmail.trim().toLowerCase();
      }

      toast('Authenticating with Discord profile...', 'info', 2000);
      const name = userEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const res = await window.DB.socialLogin('discord', userEmail, name);
      handleAuthResponse(res, 'Discord');

    } catch (err) {
      console.error('[social.js] Discord auth error:', err);
      toast('Discord Authentication error. Please try again.', 'error');
    }
  }

  // ─── Unified Social Login Completion ─────────────────────────────────────────
  function handleAuthResponse(data, providerName) {
    if (data && data.success && data.user) {
      window.DB.setCurrentUser({ ...data.user, token: data.token });
      toast(`🎉 Welcome, ${data.user.name}! (${providerName} Authenticated)`, 'success', 4000);
      if (window.Router) {
        window.Router.navigate(window.Router.getSessionRoute());
      }
    } else {
      toast(`❌ ${data ? data.error : `${providerName} login failed.`}`, 'error');
    }
  }

  // ─── Toast helper ────────────────────────────────────────────────────────────
  function toast(msg, type, dur) {
    if (window.showToast) window.showToast(msg, type || 'info', dur);
    else console.log('[toast]', type, msg);
  }

  // ─── Expose global sign-in functions ─────────────────────────────────────────
  window._googleSignIn = triggerGoogleSignIn;
  window._githubSignIn = triggerGitHubSignIn;
  window._discordSignIn = triggerDiscordSignIn;

  console.log('[social.js] ✅ Ready — _googleSignIn, _githubSignIn, _discordSignIn available');
})();
