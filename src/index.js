import AsyncStorage from '@react-native-async-storage/async-storage';

const CDN_BASE = 'https://cdn.consents.dev';
const CAT_MAP  = { 3: 'statistics', 4: 'marketing', 5: 'preferences', 6: 'unclassified' };

// ─────────────────────────────────────────────────────────────
// IAB TCF v2.3 — IABTCF_* AsyncStorage keys
// Spec: https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
// ─────────────────────────────────────────────────────────────

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function _intToBits(value, length) {
  const bin = (value >>> 0).toString(2);
  return bin.padStart(length, '0').slice(-length);
}

function _langToBits(lang) {
  const upper = (lang || 'EN').toUpperCase();
  const a = Math.max(0, upper.charCodeAt(0) - 65);
  const b = Math.max(0, upper.charCodeAt(1) - 65);
  return _intToBits(a, 6) + _intToBits(b, 6);
}

function _base64urlEncode(bits) {
  const rem = bits.length % 6;
  const padded = rem ? bits + '0'.repeat(6 - rem) : bits;
  let result = '';
  for (let i = 0; i < padded.length; i += 6) {
    result += BASE64URL[parseInt(padded.slice(i, i + 6), 2)];
  }
  return result;
}

// Seers CMP registered ID (IAB TCF Global Vendor List)
const SEERS_CMP_ID      = 158;
const SEERS_CMP_VERSION = 1;
// Google Consent Mode v2 developer ID
const SEERS_GOOGLE_DEV_ID = 'dNmU0M2';

function _buildTCString(purposeConsents, cmpId = SEERS_CMP_ID, cmpVersion = SEERS_CMP_VERSION) {
  const now = Math.floor(Date.now() / 100); // deciseconds
  let bits = '';
  bits += _intToBits(2,          6);   // version
  bits += _intToBits(now,        36);  // created
  bits += _intToBits(now,        36);  // lastUpdated
  bits += _intToBits(cmpId,      12);
  bits += _intToBits(cmpVersion, 12);
  bits += _intToBits(0,          6);   // consentScreen
  bits += _langToBits('EN');           // consentLanguage
  bits += _intToBits(48,         12);  // vendorListVersion
  bits += _intToBits(4,          6);   // tcfPolicyVersion
  bits += '0';                         // isServiceSpecific
  bits += '0';                         // useNonStandardTexts
  bits += '0'.repeat(12);              // specialFeatureOptIns
  bits += purposeConsents.join('') + '0'.repeat(14); // purposeConsents 24 bits
  bits += '0'.repeat(24);              // purposeLegitimateInterests
  bits += '0';                         // purposeOneTreatment
  bits += _langToBits('AA');           // publisherCC
  bits += _intToBits(0, 16) + '0';    // vendorConsents
  bits += _intToBits(0, 16) + '0';    // vendorLI
  bits += _intToBits(0, 12);           // numRestrictions
  return _base64urlEncode(bits);
}

async function _storeIABTCF({ necessary, preferences, statistics, marketing, cmpId = SEERS_CMP_ID, cmpVersion = SEERS_CMP_VERSION }) {
  const pc = Array(10).fill('0');
  pc[0] = '1'; // necessary
  if (marketing)   { [1,2,3,4].forEach(p => { if (p <= 10) pc[p-1] = '1'; }); }
  if (statistics)  { [7,8,9].forEach(p =>   { if (p <= 10) pc[p-1] = '1'; }); }
  if (preferences) { [5,6].forEach(p =>     { if (p <= 10) pc[p-1] = '1'; }); }
  const pcStr = pc.join('');

  const li = Array(10).fill('0');
  if (statistics)  { li[6] = '1'; li[7] = '1'; }
  if (preferences) { li[5] = '1'; }
  const liStr = li.join('');

  const pairs = [
    ['IABTCF_CmpSdkID',                      String(cmpId)],
    ['IABTCF_CmpSdkVersion',                 String(cmpVersion)],
    ['IABTCF_PolicyVersion',                 '1'],
    ['IABTCF_gdprApplies',                   '1'],
    ['IABTCF_UseNonStandardTexts',           '1'],
    ['IABTCF_PurposeConsents',               pcStr],
    ['IABTCF_PurposeLegitimateInterests',    liStr],
    ['IABTCF_SpecialFeaturesOptIns',         '00'],
    ['IABTCF_VendorConsents',                ''],
    ['IABTCF_VendorLegitimateInterests',     ''],
    ['IABTCF_PublisherConsent',              pcStr],
    ['IABTCF_PublisherLegitimateInterests',  liStr],
    ['IABTCF_TCString',                      _buildTCString(pc, cmpId, cmpVersion)],
    ['IABTCF_ConsentTimestamp',              String(Math.floor(Date.now() / 1000))],
  ];
  await AsyncStorage.multiSet(pairs);
}

async function _getIABTCFData() {
  const keys = [
    'IABTCF_TCString', 'IABTCF_CmpSdkID', 'IABTCF_CmpSdkVersion',
    'IABTCF_gdprApplies', 'IABTCF_PurposeConsents', 'IABTCF_PurposeLegitimateInterests',
    'IABTCF_SpecialFeaturesOptIns', 'IABTCF_VendorConsents',
    'IABTCF_PublisherConsent', 'IABTCF_ConsentTimestamp',
  ];
  const pairs = await AsyncStorage.multiGet(keys);
  return Object.fromEntries(pairs.map(([k, v]) => [k, v ?? '']));
}

let _config     = null;
let _settingsId = null;
let _callbacks  = {};
let _lastPayload = null;
let _appId       = null;
let _lastConsent = null; // cached after saveConsent for sync getConsentMap()

const SeersCMP = {

  async initialize({ settingsId, onShowBanner, onConsent, onConsentRestored }) {
    _settingsId = settingsId;
    _callbacks  = { onShowBanner, onConsent, onConsentRestored };

    const stored = await this.getConsent();
    if (stored && !_isExpired(stored)) {
      _lastConsent = stored;
      const map = this.getConsentMap();
      onConsentRestored?.(stored, map);
      _scheduleRetry(settingsId, 1);
      return;
    }

    const ts = Math.floor(Date.now() / 60000);
    _config = await _fetchConfig(settingsId, ts);
    if (!_config?.eligible) return;

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
      privacyFrameworks: _getPrivacyFrameworks(),
      blockList:  _buildBlockList(_config),
      regulation: region?.regulation,
      sdkKey:     settingsId,
      dpsList:    Array.isArray(_config.dps_list) ? _config.dps_list : [],
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

  getPrivacyFrameworks() { return _getPrivacyFrameworks(); },
  frameworkEnabled(key) { return _frameworkEnabled(key); },
  getConsentSignals({ value = 'custom', preferences = false, statistics = false, marketing = false, doNotSell = null, attStatus = null } = {}) {
    return _getConsentSignals({ value, preferences, statistics, marketing, doNotSell, attStatus });
  },

  async saveConsent({ value, preferences, statistics, marketing, doNotSell = null, attStatus = null }) {
    if (!_settingsId) return;
    const expire = _config?.dialogue?.agreement_expire ?? 365;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expire);
    const privacySignals = _getConsentSignals({ value, preferences, statistics, marketing, doNotSell, attStatus });
    const consent = {
      sdk_key: _settingsId, value, necessary: true,
      preferences: preferences ?? false, statistics: statistics ?? false, marketing: marketing ?? false,
      do_not_sell: privacySignals.universalOptOut.doNotSell,
      privacy_signals: privacySignals,
      timestamp: new Date().toISOString(), expiry: expiry.toISOString(),
    };
    await AsyncStorage.setItem(`SeersConsent_${_settingsId}`, JSON.stringify(consent));
    _lastConsent = consent;
    // Store IAB TCF v2.3 keys (only if enabled in dashboard)
    if (_config?.dialogue?.enable_iab_tcf) {
      await _storeIABTCF({ necessary: true, preferences: preferences ?? false, statistics: statistics ?? false, marketing: marketing ?? false });
    }
    _logConsent(_settingsId, consent, _config);
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

  /** Returns IAB TCF v2.3 consent data (IABTCF_* keys). */
  async getTCData() { return _getIABTCFData(); },

  /** Call when app regains connectivity to flush any queued consent log. */
  async retryQueuedConsent() {
    if (!_settingsId) return;
    try {
      const raw = await AsyncStorage.getItem(`SeersConsentQueue_${_settingsId}`);
      if (!raw) return;
      const consent = JSON.parse(raw);
      await _logConsent(_settingsId, consent, _config);
    } catch {}
  },
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

// Allowlist of trusted Seers CMP hosts — prevents SSRF (CWE-918)
const SEERS_ALLOWED_HOSTS = [
  'consents.dev',
  'seers.ai',
  'seersco.com',
  'cdn.consents.dev',
];

function _isAllowedHost(urlString) {
  try {
    const url = new URL(urlString);
    return SEERS_ALLOWED_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

async function _fetchConfig(sdkKey, ts) {
  const url = `${CDN_BASE}/mobile/configs/${sdkKey}.json?v=${ts}`;
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (r.status === 404) return { eligible: false };
    if (r.ok) {
      const text = await r.text();
      // Cache on success
      await AsyncStorage.setItem(`SeersConfig_${sdkKey}`, text);
      return JSON.parse(text);
    }
  } catch {}
  // Network failed — use cached config
  try {
    const cached = await AsyncStorage.getItem(`SeersConfig_${sdkKey}`);
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
}

async function _checkRegion(sdkKey, config) {
  const host = config?.cx_host ?? '';
  if (!host || !_isAllowedHost(host)) return { regulation: 'gdpr', eligible: true };
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
  const consent   = _lastConsent;
  return {
    statistics:   { allowed: consent?.statistics  ?? false, sdks: blockList.statistics   },
    marketing:    { allowed: consent?.marketing   ?? false, sdks: blockList.marketing    },
    preferences:  { allowed: consent?.preferences ?? false, sdks: blockList.preferences  },
    unclassified: { allowed: false,                          sdks: blockList.unclassified },
  };
}

function _getPrivacyFrameworks() {
  const d = _config?.dialogue ?? {};
  return _config?.privacy_frameworks ?? {
    google_consent_mode_v2: { enabled: !!d.apply_google_consent },
    iab_tcf: { enabled: !!d.enable_iab_tcf, version: '2.3' },
    apple_att: { enabled: !!d.apple_att, applies: ['ios', 'both', 'react_native', 'flutter'].includes(_config?.platform) },
    google_play_disclosure: { enabled: !!d.google_play_disclosure, applies: ['android', 'both', 'react_native', 'flutter'].includes(_config?.platform) },
    universal_opt_out: { enabled: !!d.universal_opt_out, signal: 'do_not_sell_or_share' },
    conditional: {
      gpp: !!d.enable_gpp,
      microsoft_clarity: !!d.microsoft_clarity_consent,
      meta_facebook_sdk: !!d.meta_sdk_consent,
      microsoft_ads: !!d.microsoft_ads_consent,
      amazon_ads: !!d.amazon_ads_consent,
    },
  };
}

function _frameworkEnabled(key) {
  const parts = key.split('.');
  let node = _getPrivacyFrameworks();
  for (const part of parts) node = node?.[part];
  return node === true || node?.enabled === true;
}

function _getConsentSignals({ value = 'custom', preferences = false, statistics = false, marketing = false, doNotSell = null, attStatus = null } = {}) {
  const frameworks = _getPrivacyFrameworks();
  const optOut = doNotSell ?? value === 'disagree';
  return {
    appleATT: { enabled: !!frameworks.apple_att?.enabled, applies: !!frameworks.apple_att?.applies, status: attStatus },
    googlePlayDisclosure: { enabled: !!frameworks.google_play_disclosure?.enabled, applies: !!frameworks.google_play_disclosure?.applies },
    googleConsentModeV2: {
      enabled: !!frameworks.google_consent_mode_v2?.enabled,
      analytics_storage: statistics ? 'granted' : 'denied',
      ad_storage: marketing ? 'granted' : 'denied',
      ad_user_data: marketing ? 'granted' : 'denied',
      ad_personalization: marketing ? 'granted' : 'denied',
    },
    iabTCF: { enabled: !!frameworks.iab_tcf?.enabled, version: frameworks.iab_tcf?.version ?? '2.3' },
    universalOptOut: { enabled: !!frameworks.universal_opt_out?.enabled, signal: frameworks.universal_opt_out?.signal ?? 'do_not_sell_or_share', doNotSell: !!optOut },
    conditional: frameworks.conditional ?? {},
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

// Returns a stable anonymous device ID scoped to this sdk_key.
// Generated once, stored in AsyncStorage, never changes.
// Used for MAU deduplication — not linked to any PII.
async function _getOrCreateDeviceId(sdkKey) {
  const key = `SeersDeviceId_${sdkKey}`;
  try {
    const existing = await AsyncStorage.getItem(key);
    if (existing) return existing;
    const newId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await AsyncStorage.setItem(key, newId);
    return newId;
  } catch { return 'unknown'; }
}

async function _logConsent(sdkKey, consent, config) {
  const host = config?.cx_host ?? '';
  if (!host || !_isAllowedHost(host)) { await _queueConsent(sdkKey, consent); return; }
  try {
    const deviceId = await _getOrCreateDeviceId(sdkKey);
    const r = await fetch(`${host}/api/mobile/sdk/save-consent`, {
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
        do_not_sell: consent.do_not_sell,
        privacy_signals: consent.privacy_signals,
        timestamp:   consent.timestamp,
        // Stable anonymous device ID for MAU deduplication — not PII
        device_id:   deviceId,
        app_version: SeersCMP.appVersion ?? null,
        email:       SeersCMP.userEmail  ?? null,
      }),
    });
    if (r.ok) {
      await AsyncStorage.removeItem(`SeersConsentQueue_${sdkKey}`);
    } else {
      await _queueConsent(sdkKey, consent);
    }
  } catch {
    await _queueConsent(sdkKey, consent);
  }
}

async function _queueConsent(sdkKey, consent) {
  await AsyncStorage.setItem(`SeersConsentQueue_${sdkKey}`, JSON.stringify(consent));
}

function _scheduleRetry(sdkKey, attempt) {
  if (attempt > 5) return;
  const delay = Math.pow(2, attempt) * 1000;
  setTimeout(async () => {
    try {
      const raw = await AsyncStorage.getItem(`SeersConsentQueue_${sdkKey}`);
      if (!raw) return;
      const consent = JSON.parse(raw);
      await _logConsent(sdkKey, consent, _config);
      const stillQueued = await AsyncStorage.getItem(`SeersConsentQueue_${sdkKey}`);
      if (stillQueued) _scheduleRetry(sdkKey, attempt + 1);
    } catch {}
  }, delay);
}

export default SeersCMP;
