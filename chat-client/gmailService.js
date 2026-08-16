/**
 * ============================================================================
 * gmailService.js - Pure Node.js / Electron Zero-Dependency Gmail API Service
 * Official Google OAuth 2.0 Loopback & Gmail REST API v1 (Zero Missing Modules)
 * ============================================================================
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LOOPBACK_PORT = 42813;
const REDIRECT_URI = `http://127.0.0.1:${LOOPBACK_PORT}/callback`;

// Store tokens in user's writable AppData directory to prevent read-only ASAR errors
const USER_DATA_DIR = app ? app.getPath('userData') : __dirname;
const TOKEN_PATH = path.join(USER_DATA_DIR, 'antigravity_gmail_tokens.json');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
].join(' ');

const DEFAULT_CLIENT_ID = '15401024049-dp09ffcq1qop4sb2hauerpmu42bdbgrp.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = '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';

class GmailService {
  constructor(clientId = DEFAULT_CLIENT_ID, clientSecret = DEFAULT_CLIENT_SECRET) {
    this.clientId = clientId || DEFAULT_CLIENT_ID;
    this.clientSecret = clientSecret || DEFAULT_CLIENT_SECRET;
    this.tokens = this.loadSavedTokens() || {};
  }

  updateCredentials(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  loadSavedTokens() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        const raw = fs.readFileSync(TOKEN_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Could not read saved tokens file:', err.message);
    }
    return null;
  }

  saveTokens(newTokens) {
    try {
      this.tokens = { ...this.tokens, ...newTokens };
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(this.tokens, null, 2), 'utf-8');
      console.log('💾 Tokens saved successfully in user data directory.');
    } catch (err) {
      console.error('Failed to save tokens:', err.message);
    }
  }

  clearTokens() {
    try {
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }
      this.tokens = {};
    } catch (err) {
      console.warn('Error clearing tokens:', err.message);
    }
  }

  isAuthenticated() {
    return !!(this.tokens && (this.tokens.access_token || this.tokens.refresh_token));
  }

  /**
   * Refreshes the access token using the stored refresh token
   */
  async getValidAccessToken() {
    if (!this.tokens || (!this.tokens.access_token && !this.tokens.refresh_token)) {
      throw new Error('Not authenticated. Please sign in with Google first.');
    }

    // If access token exists and not expired (with 60s buffer)
    if (this.tokens.access_token && this.tokens.expiry_date && Date.now() < (this.tokens.expiry_date - 60000)) {
      return this.tokens.access_token;
    }

    // Refresh if refresh_token is available
    if (this.tokens.refresh_token && this.clientId) {
      try {
        const refreshParams = new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret || '',
          refresh_token: this.tokens.refresh_token,
          grant_type: 'refresh_token'
        });

        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: refreshParams.toString()
        });

        const data = await res.json();
        if (data.access_token) {
          const expiryDate = Date.now() + (data.expires_in * 1000);
          this.saveTokens({
            access_token: data.access_token,
            expiry_date: expiryDate
          });
          return data.access_token;
        }
      } catch (err) {
        console.warn('Token refresh failed, falling back to current access_token:', err.message);
      }
    }

    return this.tokens.access_token;
  }

  /**
   * Starts local loopback OAuth server on port 42813
   */
  startOAuthFlow(onOpenBrowser) {
    // Close existing server if already open to prevent EADDRINUSE
    if (this.activeLoopbackServer) {
      try {
        this.activeLoopbackServer.close();
      } catch (e) {}
      this.activeLoopbackServer = null;
    }

    return new Promise((resolve) => {
      let server = null;

      const cleanup = () => {
        if (server) {
          try {
            server.close();
          } catch (e) {}
          server = null;
        }
        this.activeLoopbackServer = null;
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve({ success: false, message: 'Google Sign-In timed out. Please try again.' });
      }, 120000);

      server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);

        if (parsedUrl.pathname === '/callback') {
          const authCode = parsedUrl.query.code;
          const authError = parsedUrl.query.error;

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>QuickChat - Authentication</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #111b21; color: #e9edef; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #202c33; padding: 40px 48px; border-radius: 12px; border: 1px solid #00a884; text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
                h1 { color: #00a884; font-size: 22px; margin-top: 0; }
                p { color: #8696a0; font-size: 14px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>✅ Google Login Successful!</h1>
                <p>Your Google account has been connected to <strong>QuickChat</strong>.</p>
                <p>You can close this tab and return to the app.</p>
              </div>
              <script>setTimeout(() => window.close(), 2500);</script>
            </body>
            </html>
          `);

          clearTimeout(timeout);
          cleanup();

          if (authError) {
            return resolve({ success: false, message: `Google OAuth Error: ${authError}` });
          }

          if (!authCode) {
            return resolve({ success: false, message: 'No authorization code received from Google.' });
          }

          try {
            // Exchange code for tokens
            const tokenParams = new URLSearchParams({
              code: authCode,
              client_id: this.clientId || DEFAULT_CLIENT_ID,
              client_secret: this.clientSecret || DEFAULT_CLIENT_SECRET,
              redirect_uri: REDIRECT_URI,
              grant_type: 'authorization_code'
            });

            const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: tokenParams.toString()
            });

            const tokenData = await tokenRes.json();

            if (!tokenData.access_token) {
              return resolve({
                success: false,
                message: tokenData.error_description || 'Failed to exchange authorization code for access token.'
              });
            }

            const expiryDate = Date.now() + (tokenData.expires_in * 1000);
            this.saveTokens({
              access_token: tokenData.access_token,
              refresh_token: tokenData.refresh_token || this.tokens.refresh_token,
              id_token: tokenData.id_token,
              expiry_date: expiryDate
            });

            // Fetch Google User Profile
            const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenData.access_token}` }
            });
            const profile = await profileRes.json();

            resolve({
              success: true,
              user: {
                name: profile.name || profile.given_name || 'Google User',
                email: profile.email,
                photoURL: profile.picture || '👤'
              }
            });
          } catch (err) {
            resolve({ success: false, message: 'OAuth exchange failed: ' + err.message });
          }
        }
      });

      this.activeLoopbackServer = server;

      server.listen(LOOPBACK_PORT, '127.0.0.1', () => {
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(this.clientId || DEFAULT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;

        if (typeof onOpenBrowser === 'function') {
          onOpenBrowser(authUrl);
        }
      });

      server.on('error', (err) => {
        clearTimeout(timeout);
        cleanup();
        if (err.code === 'EADDRINUSE') {
          // Port is busy, trigger browser with auth URL anyway since loopback listener might already be active
          const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(this.clientId || DEFAULT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;
          if (typeof onOpenBrowser === 'function') {
            onOpenBrowser(authUrl);
          }
        } else {
          resolve({ success: false, message: 'OAuth listener error: ' + err.message });
        }
      });
    });
  }

  /**
   * RFC 2822 MIME message formatted to URL-Safe Base64
   */
  buildRawEmail({ to, subject, body, from, isHtml = true }) {
    const contentType = isHtml ? 'text/html; charset=UTF-8' : 'text/plain; charset=UTF-8';
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;

    const messageLines = [
      from ? `From: ${from}` : '',
      `To: ${to.trim()}`,
      `Subject: ${utf8Subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: ${contentType}`,
      `Content-Transfer-Encoding: 7bit`,
      '',
      body
    ].filter(line => line !== null);

    const rfc2822String = messageLines.join('\r\n');

    return Buffer.from(rfc2822String, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Sends an email via official Gmail REST API v1 (Zero dependencies)
   */
  async sendEmail({ to, subject, body, from, isHtml = true }) {
    if (!this.isAuthenticated()) {
      return {
        success: false,
        error: 'Please sign in with your Google account first.'
      };
    }

    if (!to || !to.includes('@')) {
      return {
        success: false,
        error: 'Invalid recipient email address.'
      };
    }

    try {
      const accessToken = await this.getValidAccessToken();
      const raw = this.buildRawEmail({ to, subject, body, from, isHtml });

      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      });

      const data = await response.json();

      if (response.ok && data.id) {
        return {
          success: true,
          messageId: data.id,
          threadId: data.threadId
        };
      } else {
        let errorMsg = data.error?.message || 'Failed to send email via Gmail API.';
        if (response.status === 401) {
          errorMsg = 'Session expired. Please sign in with Google again.';
        } else if (response.status === 403) {
          errorMsg = 'Permission denied. Make sure "https://www.googleapis.com/auth/gmail.send" scope is added in Google Console.';
        }
        return { success: false, error: errorMsg };
      }
    } catch (err) {
      return { success: false, error: 'Network error sending email: ' + err.message };
    }
  }
}

module.exports = GmailService;
