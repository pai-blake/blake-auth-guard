/**
 * static/template/js/template.js
 * AuthGuard — Template Module (Legacy Entry Point / README)
 *
 * NOTE: This file is NOT loaded by core/template/shell.html anymore.
 *       The module now uses a modular backbone. Scripts load in this order:
 *
 *   1. components/core.js   → TemplateCore   (State & event bus)
 *   2. components/ui.js     → TemplateUI     (DOM helpers & view switching)
 *   3. components/router.js → TemplateRouter (In-page hash routing)
 *   4. pages/main.js        → TemplateMainPage (Route registration & page logic)
 *   5. components/app.js    → TemplateApp    (Bootstrap: wires all of the above)
 *
 * To customize this module:
 *   • Add business logic to components/core.js
 *   • Add new routes in pages/main.js
 *   • Add new view sections in core/template/views/pages/template.html
 *   • Add styles in static/template/css/components/ and import in style.css
 */
