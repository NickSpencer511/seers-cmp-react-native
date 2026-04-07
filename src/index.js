import AsyncStorage from '@react-native-async-storage/async-storage';

const CDN_BASE = 'https://cdn.seersco.com';
const CAT_MAP  = { 3: 'statistics', 4: 'marketing', 5: 'preferences', 6: 'unclassified' };

let _config     = null;
let _settingsId = null;
let _callbacks  = {};

const SeersCMP = {

  /**
   * Initialize the SDK. Call once in App.js useEffect or index.js.
   *
   *   SeersCMP.initialize({
   *     settingsId: 'YOUR_SDK_KEY',
   *     onShowBanner: (payload) => setPayload(payload),
   *     onConsent: (consent, map) => applyConsent(map),
   *   });
   */
  async initialize({ settingsId, onShowBanner, onConsent, onConsentRestored }) {
    _settingsId = settingsId;
    _callbacks  = { onShowBanner, onConsent, onConsentRestored };

    // Check stored consent
    const stored = await this.getConsent();
    if (stored && !_isExpired(stored)) {
      const map = this.getConsentMap();
      onConsentRestored?.(stored, map);
      return;
    }

    // Fetch config
    _config = await _fetchConfig(settingsId);
    if (!_config?.eligible) return;

    // Region check
    const region = await _checkRegion(settingsId, _config);
    if (!_shouldShow(_config.dialogue, region)) return;

    const lang    = _resolveLanguage(_config, region);
    const payload = {
      dialogue:   _config.dialogue,
      banner:     _config.banner,
      language:   lang,
      categories: _config.categories,
      blockList:  _buildBlockList(_config),
      regulation: region?.regulation,
      sdkKey:     settingsId,
    };
    onShowBanner?.(payload);
  },

  /**
   * Check if a specific SDK should be blocked.
   *
   *   const blocked = SeersCMP.shouldBlock('com.google.firebase.analytics');
   *   if (!blocked) { await analytics().setAnalyticsCollectionEnabled(true); }
   */
  shouldBlock(identifier) {
    return _checkBlock(identifier).blocked;
  },

  /** Get full consent map. */
  getConsentMap() {
    return _buildConsentMap();
  },

  /** Get stored consent. */
  async getConsent() {
    if (!_settingsId) return null;
    try {
      const raw = await AsyncStorage.getItem(`SeersConsent_${_settingsId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  /** Save consent after user makes a choice. */
  async saveConsent({ value, preferences, statistics, marketing }) {
    if (!_settingsId) return;
    const expire = _config?.dialogue?.agreement_expire ?? 365;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expire);

    const consent = {
      sdk_key:     _settingsId,
      value,
      necessary:   true,
      preferences: preferences ?? false,
      statistics:  statistics  ?? false,
      marketing:   marketing   ?? false,
      timestamp:   new Date().toISOString(),
      expiry:      expiry.toISOString(),
    };

    await AsyncStorage.setItem(`SeersConsent_${_settingsId}`, JSON.stringify(consent));
    _logConsent(_settingsId, consent, _config);

    const map = _buildConsentMap();
    _callbacks.onConsent?.(consent, map);
    return { consent, consentMap: map };
  },
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

async function _fetchConfig(sdkKey) {
  const urls = [
    `${CDN_BASE}/mobile/configs/${sdkKey}.json`,
    `${_config?.cx_host ?? ''}/api/mobile/sdk/config/${sdkKey}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) return await r.json();
    } catch {}
  }
  return null;
}

async function _checkRegion(sdkKey, config) {
  const host = config?.cx_host ?? '';
  try {
    const r = await fetch(`${host}/api/mobile/sdk/${sdkKey}`, { cache: 'no-cache' });
    if (r.ok) return await r.json();
  } catch {}
  return { regulation: 'gdpr', eligible: true };
}

function _buildBlockList(config) {
  const list = { statistics: [], marketing: [], preferences: [], unclassified: [] };
  const mode    = config?.blocking_mode    ?? 'none';
  const domains = config?.blocking_domains ?? [];
  if (mode === 'none' || !domains.length) return list;

  for (const item of domains) {
    const identifier = mode === 'prior_consent' ? item.d   : item.src;
    const catId      = mode === 'prior_consent' ? item.c   : item.category;
    const cat        = CAT_MAP[catId] ?? 'unclassified';
    if (identifier && list[cat]) list[cat].push(identifier);
  }
  return list;
}

function _checkBlock(identifier) {
  const consent   = null; // sync check — use getConsent() for async
  const blockList = _buildBlockList(_config);
  const id        = identifier?.toLowerCase() ?? '';

  for (const [cat, sdks] of Object.entries(blockList)) {
    for (const sdk of sdks) {
      if (id.includes(sdk.toLowerCase())) {
        return { blocked: true, category: cat };
      }
    }
  }
  return { blocked: false, category: null };
}

function _buildConsentMap() {
  const blockList = _buildBlockList(_config);
  // Note: sync — for async consent check use getConsent() first
  return {
    statistics:   { allowed: false, sdks: blockList.statistics   },
    marketing:    { allowed: false, sdks: blockList.marketing    },
    preferences:  { allowed: false, sdks: blockList.preferences  },
    unclassified: { allowed: false, sdks: blockList.unclassified },
  };
}

function _shouldShow(dialogue, region) {
  if (!dialogue) return false;
  if (dialogue.region_detection) {
    return region?.eligible === true && region?.regulation !== 'none';
  }
  return true;
}

function _resolveLanguage(config, region) {
  if (config.language) return config.language;
  const code = region?.data?.country_iso_code ?? config.dialogue?.default_language ?? 'GB';
  return config.languages?.find(l => l.country_code === code) ?? config.languages?.[0] ?? null;
}

function _isExpired(consent) {
  if (!consent?.expiry) return true;
  return new Date() > new Date(consent.expiry);
}

async function _logConsent(sdkKey, consent, config) {
  const host = config?.cx_host ?? '';
  try {
    await fetch(`${host}/api/mobile/sdk/save-consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdk_key:    sdkKey,
        platform:   config?.platform ?? 'react_native',
        consent:    consent.value,
        categories: {
          necessary:   consent.necessary,
          preferences: consent.preferences,
          statistics:  consent.statistics,
          marketing:   consent.marketing,
        },
        timestamp: consent.timestamp,
      }),
    });
  } catch {}
}

export default SeersCMP;
