// Lightweight GA4 helpers. No build step / modules — plain globals.
// The GA4 tag is bootstrapped in index.html with send_page_view:false,
// so the Backbone router owns page_view tracking (avoids double-counting).
window.trackPageView = function (path) {
    if (window.gtag) {
        window.gtag('event', 'page_view', {
            page_path: path,
            page_title: document.title
        });
    }
};

window.trackEvent = function (action, params) {
    if (window.gtag) {
        window.gtag('event', action, params || {});
    }
};
