/**
 * Development proxy – mirrors the ALB path-based routing rules so that
 * `npm start` in the client/ directory talks to the correct microservice.
 *
 * Service ports (matching docker-compose.yml and Dockerfile.* EXPOSE values):
 *   auth-service     → 3001  (/api/signup, /api/login, /api/logout, /redirect/*, …)
 *   meetings-service → 3002  (/api/meetings, /api/meetings/*)
 *   users-service    → 3003  (/api/me, /api/me/*)
 *
 * Override port for monolith mode:
 *   PROXY_PORT=3001 npm start
 *
 * For full microservices mode start all three services first:
 *   docker compose up  (or npm run start:auth / start:meetings / start:users in server/)
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

const AUTH_PORT     = process.env.AUTH_PORT     || '3001';
const MEETINGS_PORT = process.env.MEETINGS_PORT || '3002';
const USERS_PORT    = process.env.USERS_PORT    || '3003';

// If PROXY_PORT is set, all traffic goes to one port (monolith / legacy mode).
const MONOLITH_PORT = process.env.PROXY_PORT;

function target(port) {
  return `http://127.0.0.1:${MONOLITH_PORT || port}`;
}

module.exports = function (app) {
  // ── Meetings service (/api/meetings, /api/meetings/*) ──────────────────────
  app.use(
    ['/api/meetings'],
    createProxyMiddleware({ target: target(MEETINGS_PORT), changeOrigin: true }),
  );

  // ── Users service (/api/me, /api/me/*) ────────────────────────────────────
  app.use(
    ['/api/me'],
    createProxyMiddleware({ target: target(USERS_PORT), changeOrigin: true }),
  );

  // ── Auth service – everything else under /api and /redirect ───────────────
  // Covers: /api/signup, /api/login, /api/logout, /api/verify-email,
  //         /api/reset-password, /api/confirm-password-reset,
  //         /api/login-with-google, /api/signup-with-google,
  //         /api/login-with-microsoft, /api/signup-with-microsoft,
  //         /api/server-info, /redirect/*
  app.use(
    ['/api', '/redirect'],
    createProxyMiddleware({ target: target(AUTH_PORT), changeOrigin: true }),
  );
};
