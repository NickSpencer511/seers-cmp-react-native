import AsyncStorage from '@react-native-async-storage/async-storage';

const CDN_BASE = 'https://cdn.consents.dev';
const CAT_MAP  = { 3: 'statistics', 4: 'marketing', 5: 'preferences', 6: 'unclassified' };

let _config     = null;
let _settingsId = null;
let _callbacks  = {};
let _lastPayload = null;
let _appId       = null;

const SeersCMP = {

  async initialize({ settingsId, onShowBanner, onConsent, onConsentRestored }) {
    _settingsId = settingsId;
    _callbacks  = { onShowBanner, onConsent, onConsentRestored };

    const stored = await this.getConsent();
    if (stored && !_isExpired(stored)) {
      const map = this.getConsentMap();
      onConsentRestored?.(stored, map);
      return;
    }

    // Cache-busting: changes every minute so deleted configs aren't served from CDN cache
    const ts = Math.floor(Date.now() / 60000);
    _config = await _fetchConfig(settingsId, ts);
    if (!_config?.eligible) return;

    // App identity verification
    if (_appId) {
      const registered = _config.bundle_id || _config.package_name;
      if (registered && _appId.toLowerCase() !== registered.toLowerCase()) return;
    }

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
    _lastPayload = payload;
    onShowBanner?.(payload);
  },

  /** Set your app's package/bundle ID for security verification */
  set appId(id) { _appId = id; },
  get appId()   { return _appId; },

  /** Optional: set app version for consent log enrichment.
   *   SeersCMP.appVersion = '1.0.0'; */
  appVersion: null,

  /** Optional: set user email for consent log enrichment.
   *   SeersCMP.userEmail = 'user@example.com'; */
  userEmail: null,

  /** Last banner payload fetched from CDN */
  get lastPayload() { return _lastPayload; },

  shouldBlock(identifier) { return _checkBlock(identifier).blocked; },

  /** Regulation type: 'gdpr' | 'ccpa' | 'none' */
  get regulation() { return _lastPayload?.regulation ?? 'gdpr'; },
  get isGdpr()     { return this.regulation === 'gdpr'; },
  get isCcpa()     { return this.regulation === 'ccpa'; },
  get isNone()     { return this.regulation === 'none'; },

  /**
   * Call BEFORE initialising any third-party SDK.
   * GDPR (region_selection 1|3) → pre-block until consent given.
   * CCPA (region_selection 2)   → NOT pre-blocked; block only after explicit opt-out.
   * none (region_selection 0)   → never block.
   *
   * Example:
   *   if (!await SeersCMP.shouldBlockNow('com.google.firebase')) {
   *     await analytics().setAnalyticsCollectionEnabled(true);
   *   }
   */
  async shouldBlockNow(identifier) {
    if (this.isNone) return false;

    const stored = await this.getConsent();

    // Consent already given — check per-category
    if (stored && !_isExpired(stored)) {
      return _checkBlockWithConsent(identifier, stored);
    }

    // No consent yet:
    // GDPR → pre-block everything in block list
    if (this.isGdpr) return _checkBlock(identifier).blocked;

    // CCPA → don't pre-block (opt-out model)
    return false;
  },
  getConsentMap()         { return _buildConsentMap(); },

  async getConsent() {
    if (!_settingsId) return null;
    try {
      const raw = await AsyncStorage.getItem(`SeersConsent_${_settingsId}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async saveConsent({ value, preferences, statistics, marketing }) {
    if (!_settingsId) return;
    const expire = _config?.dialogue?.agreement_expire ?? 365;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expire);
    const consent = {
      sdk_key: _settingsId, value, necessary: true,
      preferences: preferences ?? false, statistics: statistics ?? false, marketing: marketing ?? false,
      timestamp: new Date().toISOString(), expiry: expiry.toISOString(),
    };
    await AsyncStorage.setItem(`SeersConsent_${_settingsId}`, JSON.stringify(consent));
    _logConsent(_settingsId, consent, _config);
    // Build map with correct allowed values from this consent decision
    const blockList = _buildBlockList(_config);
    const map = {
      statistics:   { allowed: statistics  ?? false, sdks: blockList.statistics   },
      marketing:    { allowed: marketing   ?? false, sdks: blockList.marketing    },
      preferences:  { allowed: preferences ?? false, sdks: blockList.preferences  },
      unclassified: { allowed: false,                sdks: blockList.unclassified },
    };
    _callbacks.onConsent?.(consent, map);
    return { consent, consentMap: map };
  },
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

async function _fetchConfig(sdkKey, ts) {
  const url = `${CDN_BASE}/mobile/configs/${sdkKey}.json?v=${ts}`;
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.status === 404) return { eligible: false };
    if (r.ok) return await r.json();
  } catch {}
  return null;
}

async function _checkRegion(sdkKey, config) {
  const host = config?.cx_host ?? '';
  if (!host) return { regulation: 'gdpr', eligible: true };
  try {
    const headers = { 'Content-Type': 'text/plain' };
    if (_appId) headers['X-App-ID'] = _appId;
    const r = await fetch(`${host}/api/mobile/sdk/${sdkKey}`, { cache: 'no-cache', headers });
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
  const blockList = _buildBlockList(_config);
  const id        = identifier?.toLowerCase() ?? '';
  for (const [cat, sdks] of Object.entries(blockList)) {
    for (const sdk of sdks) {
      if (id.includes(sdk.toLowerCase())) return { blocked: true, category: cat };
    }
  }
  return { blocked: false, category: null };
}

function _checkBlockWithConsent(identifier, consent) {
  const result = _checkBlock(identifier);
  if (!result.blocked) return false;
  switch (result.category) {
    case 'statistics':  return !consent.statistics;
    case 'marketing':   return !consent.marketing;
    case 'preferences': return !consent.preferences;
    default:            return false;
  }
}

function _buildConsentMap() {
  const blockList = _buildBlockList(_config);
  // Note: allowed values are set correctly in saveConsent callback
  // For real-time check use shouldBlockNow() which reads stored consent
  return {
    statistics:   { allowed: false, sdks: blockList.statistics   },
    marketing:    { allowed: false, sdks: blockList.marketing    },
    preferences:  { allowed: false, sdks: blockList.preferences  },
    unclassified: { allowed: false, sdks: blockList.unclassified },
  };
}

function _shouldShow(dialogue, region) {
  if (!dialogue) return false;

  // region_selection=0 → never show banner
  const sel = parseInt(dialogue.region_selection ?? '1', 10);
  if (sel === 0) return false;

  if (dialogue.region_detection) return region?.eligible === true && region?.regulation !== 'none';
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
  if (!host) return;
  try {
    await fetch(`${host}/api/mobile/sdk/save-consent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdk_key:     sdkKey,
        platform:    config?.platform ?? 'react_native',
        consent:     consent.value,
        categories:  {
          necessary:   consent.necessary,
          preferences: consent.preferences,
          statistics:  consent.statistics,
          marketing:   consent.marketing,
        },
        timestamp:   consent.timestamp,
        app_version: SeersCMP.appVersion ?? null,
        email:       SeersCMP.userEmail  ?? null,
      }),
    });
  } catch {}
}

export default SeersCMP;
