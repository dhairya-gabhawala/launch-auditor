// Module path → human-readable name mapping + counters.

function countByModulePath(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.modulePath || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function prettyModuleName(modulePath) {
  const map = {
    'core/src/lib/events/customEvent.js': 'Custom Event',
    'core/src/lib/events/windowLoaded.js': 'Window Loaded',
    'core/src/lib/events/directCall.js': 'Direct Call',
    'core/src/lib/events/click.js': 'Click',
    'core/src/lib/events/domReady.js': 'DOM Ready',
    'core/src/lib/events/libraryLoaded.js': 'Library Loaded',
    'core/src/lib/events/dataElementChange.js': 'Data Element Change',
    'core/src/lib/events/elementExists.js': 'Element Exists',
    'core/src/lib/events/focus.js': 'Focus',
    'core/src/lib/events/pageBottom.js': 'Page Bottom',

    'core/src/lib/conditions/valueComparison.js': 'Value Comparison',
    'core/src/lib/conditions/customCode.js': 'Custom Code Condition',
    'core/src/lib/conditions/cookie.js': 'Cookie Condition',
    'core/src/lib/conditions/pathAndQuerystring.js': 'Path + Querystring',
    'core/src/lib/conditions/path.js': 'Path',
    'core/src/lib/conditions/variable.js': 'Variable',
    'core/src/lib/conditions/subdomain.js': 'Subdomain',

    'core/src/lib/actions/customCode.js': 'Custom Code Action',
    'adobe-analytics/src/lib/actions/setVariables.js': 'AA Set Variables',
    'adobe-analytics/src/lib/actions/clearVariables.js': 'AA Clear Variables',
    'adobe-analytics/src/lib/actions/sendBeacon.js': 'AA Send Beacon',
    'adobe-alloy/dist/lib/actions/sendEvent/index.js': 'AEP Web SDK Send Event',
    'adobe-alloy/dist/lib/actions/updateVariable/index.js': 'AEP Web SDK Update Variable',
    'facebook-pixel/src/lib/actions/sendPageView.js': 'Meta Pixel Page View',
    'facebook-pixel/src/lib/actions/sendCustomEvent.js': 'Meta Pixel Custom Event',
    'facebook-pixel/src/lib/actions/sendLeadEvent.js': 'Meta Pixel Lead',
    'facebook-pixel/src/lib/actions/sendAddToCartEvent.js': 'Meta Pixel Add To Cart',
    'facebook-pixel/src/lib/actions/sendPurchaseEvent.js': 'Meta Pixel Purchase',
    'facebook-pixel/src/lib/actions/sendViewContentEvent.js': 'Meta Pixel View Content',
    'adobe-mcid/src/lib/actions/setCustomerIds.js': 'ECID Set Customer IDs'
  };
  if (map[modulePath]) return map[modulePath];
  const parts = modulePath.split('/');
  return parts[parts.length - 1] || modulePath;
}

module.exports = {
  countByModulePath,
  prettyModuleName
};
