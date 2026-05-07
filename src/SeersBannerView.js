/**
 * SeersBannerView — React Native consent banner for SeersCMP.
 * Pixel-perfect match to the Flutter SeersBannerWidget.
 * Supports: popup, bottom_sheet, dialog templates.
 * All colours, font_size, button_type, layout read from dashboard payload.
 *
 * Usage:
 *   import SeersBannerView from './SeersBannerView';
 *
 *   // Inside your component:
 *   const [payload, setPayload] = useState(null);
 *
 *   useEffect(() => {
 *     SeersCMP.initialize({
 *       settingsId: 'YOUR_SDK_KEY',
 *       onShowBanner: (p) => setPayload(p),
 *     });
 *   }, []);
 *
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <YourApp />
 *       {payload && (
 *         <SeersBannerView payload={payload} onDismiss={() => setPayload(null)} />
 *       )}
 *     </View>
 *   );
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import SeersCMP from './index';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Keep CSS-like spacing from the Vue mobile preview on real devices.
const scale = 1;
const sp  = (px) => Math.round(px * scale); // font sizes
const dp  = (px) => Math.round(px * scale); // paddings / spacing
const DEFAULT_BADGE_DATA_URI = 'data:image/png;base64,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';
const DEFAULT_LOGO_URL = 'https://seers-application-assets.s3.amazonaws.com/images/logo/seersco-logo.png';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function hex(str) {
  if (!str || str === 'transparent') return 'transparent';
  return str.startsWith('#') ? str : `#${str}`;
}

function boolFlag(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === '1' || normalized === 'true';
  }
  return fallback;
}

function buildInitialToggles(dialogue) {
  return {
    preferences: boolFlag(dialogue?.preferences_checked),
    statistics: boolFlag(dialogue?.statistics_checked),
    marketing: boolFlag(dialogue?.targeting_checked),
  };
}

// ─────────────────────────────────────────────────────────────
// SeersBannerView
// ─────────────────────────────────────────────────────────────

export default function SeersBannerView({ payload, onDismiss }) {
  const [showPref, setShowPref]   = useState(false);
  const [dpsView, setDpsView]     = useState(false);  // DPS detail panel
  const [dpsCat, setDpsCat]       = useState('');     // which category
  const [dpsSearch, setDpsSearch] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  const [showBadge, setShowBadge] = useState(false);
  const [toggles, setToggles]     = useState(() => buildInitialToggles(payload?.dialogue));
  const [expanded, setExpanded]   = useState(new Set());
  const bannerTimerRef            = useRef(null);

  // DPS helpers — same as mobile_static.js seers_buildDpsByCategory
  const CAT_ID_MAP = { 1: 'necessary', 2: 'unclassified', 3: 'statistics', 4: 'marketing', 5: 'preferences' };
  const dpsList = payload?.dpsList ?? [];
  const getDpsForCat = (catKey) => dpsList.filter(d => (CAT_ID_MAP[d.script_category_id] ?? 'unclassified') === catKey);

  const b = payload?.banner;
  const l = payload?.language;
  const d = payload?.dialogue;

  // ── Colors — exact same fields as Flutter ──
  const bgColor      = hex(b?.banner_bg_color    ?? '#ffffff');
  const titleColor   = hex(b?.title_text_color   ?? '#1a1a1a');
  const bodyColor    = hex(b?.body_text_color     ?? '#1a1a1a');
  const agreeColor   = hex(b?.agree_btn_color     ?? '#3b6ef8');
  const agreeText    = hex(b?.agree_text_color    ?? '#ffffff');
  const declineColor = hex(b?.disagree_btn_color  ?? '#1a1a2e');
  const declineText  = hex(b?.disagree_text_color ?? '#ffffff');
  // prefFullStyle uses body_text_color for both colour and border (matches Flutter)
  const prefBorder   = bodyColor;

  // ── Font size ──
  const fs      = sp(Math.min(Math.max(parseFloat(b?.font_size) || 12, 10), 16));
  const titleFs = fs + sp(2);
  const prefFs = Math.max(fs, sp(12));
  const prefTitleFs = prefFs + sp(2);
  const prefCatNameFs = prefFs + sp(1);
  const prefCatBodyFs = prefFs - sp(1);
  const prefArrowFs = Math.max(prefFs * 0.75, sp(9));
  const selectedFont = (b?.font_style ?? '').trim().toLowerCase();
  const fontFamily = selectedFont && !['none', 'inherit'].includes(selectedFont)
    ? selectedFont
    : undefined;
  const fontStyle = fontFamily ? { fontFamily } : null;

  // ── Button type ──
  const btnType   = b?.button_type ?? 'default';
  const btnRadius = btnType.includes('rounded') ? 20 : btnType.includes('flat') ? 0 : 4;
  const isStroke  = btnType.includes('stroke');

  // ── Display style ──
  const tmpl       = d?.mobile_template ?? 'popup';
  const layout     = b?.layout   ?? 'default';
  const position   = b?.position ?? 'bottom';
  const showHandle = layout === 'rounded';

  const allowReject = d?.allow_reject === true || d?.allow_reject === 1;
  const poweredBy   = d?.powered_by   === true || d?.powered_by   === 1;
  const hasBadge    = d?.has_badge    === true || d?.has_badge    === 1;
  const bannerTimeout = parseInt(d?.banner_timeout, 10) || 0;
  const logoSrc = d?.logo_link || DEFAULT_LOGO_URL;
  const showLogo = (d?.logo_status ?? 'default') !== 'none';
  const customBadgeSrc = d?.badge_status === 'custom' && d?.badge_link ? d.badge_link : null;
  const badgeUri = customBadgeSrc || DEFAULT_BADGE_DATA_URI;

  // ── Language ──
  const bodyText     = l?.body                 ?? 'We use cookies to personalize content and ads, to provide social media features and to analyze our traffic.';
  const titleText    = l?.title                ?? 'We use cookies';
  const btnAgree     = l?.btn_agree_title      ?? 'Allow All';
  const btnDecline   = l?.btn_disagree_title   ?? 'Disable All';
  const btnPref      = l?.btn_preference_title ?? 'Cookie settings';
  const btnSave      = l?.btn_save_my_choices  ?? 'Save my choices';
  const aboutCookies = l?.about_cookies        ?? 'About Our Cookies';
  const alwaysActive = l?.always_active        ?? 'Always Active';

  const cats = [
    { key: 'necessary',   label: l?.necessory_title  ?? 'Necessary',   desc: l?.necessory_body  ?? 'Required for the website to function. Cannot be switched off.' },
    { key: 'preferences', label: l?.preference_title ?? 'Preferences', desc: l?.preference_body ?? 'Allow the website to remember choices you make.' },
    { key: 'statistics',  label: l?.statistics_title ?? 'Statistics',  desc: l?.statistics_body ?? 'Help us understand how visitors interact with the website.' },
    { key: 'marketing',   label: l?.marketing_title  ?? 'Marketing',   desc: l?.marketing_body  ?? 'Used to track visitors and display relevant advertisements.' },
  ];

  const dialogRadius = () => {
    if (layout === 'rounded') return { borderRadius: 20 };
    if (layout === 'flat')    return { borderRadius: 0 };
    return { borderRadius: 10 };
  };

  const sheetRadius = () => {
    if (layout === 'flat') return { borderRadius: 0 };
    if (layout === 'rounded') return position === 'top'
      ? { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }
      : { borderTopLeftRadius: 16, borderTopRightRadius: 16 };
    return position === 'top'
      ? { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 }
      : { borderTopLeftRadius: 14, borderTopRightRadius: 14 };
  };

  const popupRadius = { borderTopLeftRadius: 12, borderTopRightRadius: 12 };

  // ── Save consent ──
  const save = async (value, pref, stat, mkt) => {
    await SeersCMP.saveConsent({ value, preferences: pref, statistics: stat, marketing: mkt });
    clearBannerTimer();
    if (hasBadge) {
      setShowPref(false);
      setShowBanner(false);
      setShowBadge(true);
      return;
    }
    onDismiss();
  };

  const clearBannerTimer = () => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  };

  const reopenBannerFromBadge = () => {
    clearBannerTimer();
    setShowBadge(false);
    setShowBanner(true);

    if (hasBadge && bannerTimeout > 0) {
      bannerTimerRef.current = setTimeout(() => {
        setShowPref(false);
        setShowBanner(false);
        setShowBadge(true);
      }, bannerTimeout * 1000);
    }
  };

  useEffect(() => {
    clearBannerTimer();
    setShowPref(false);
    setShowBanner(true);
    setShowBadge(false);
    setExpanded(new Set());
    setToggles(buildInitialToggles(payload?.dialogue));

    return () => clearBannerTimer();
  }, [payload]);

  // ─────────────────────────────────────────────────────────
  // Buttons — exact CSS match to Flutter
  // ─────────────────────────────────────────────────────────

  // stk-outline: transparent bg, 1.5px border, body_text_color
  const StkOutline = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint="Opens cookie preference settings"
      accessibilityRole="button"
      style={[styles.stkBtn, { borderWidth: 1.5, borderColor: prefBorder, borderRadius: btnRadius }]}
    >
      <Text style={[styles.stkBtnText, fontStyle, { fontSize: fs, color: prefBorder }]}>{label}</Text>
    </TouchableOpacity>
  );

  const StkDark = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint="Rejects all optional cookies and closes the banner"
      accessibilityRole="button"
      style={[styles.stkBtn, { backgroundColor: declineColor, borderRadius: btnRadius, marginBottom: dp(5) }]}
    >
      <Text style={[styles.stkBtnText, fontStyle, { fontSize: fs, color: declineText }]}>{label}</Text>
    </TouchableOpacity>
  );

  const StkPrimary = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint="Accepts all cookies and closes the banner"
      accessibilityRole="button"
      style={[styles.stkBtn, {
        backgroundColor: isStroke ? 'transparent' : agreeColor,
        borderWidth: isStroke ? 1 : 0, borderColor: agreeColor,
        borderRadius: btnRadius,
        marginBottom: dp(5),
      }]}
    >
      <Text style={[styles.stkBtnText, fontStyle, { fontSize: fs, color: isStroke ? agreeColor : agreeText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const BtnItem = ({ label, bg, fg, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{ flex: 1, backgroundColor: bg, borderRadius: btnRadius, padding: dp(4), alignItems: 'center' }}
    >
      <Text style={[fontStyle, { fontSize: fs, color: fg, fontWeight: '600' }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  const PrefFullBtn = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityHint="Opens cookie preference settings"
      accessibilityRole="button"
      style={{
        borderWidth: 1, borderColor: prefBorder, borderRadius: btnRadius,
        paddingVertical: dp(4), paddingHorizontal: dp(6), marginBottom: dp(3),
        width: '100%', alignItems: 'center', backgroundColor: 'transparent',
      }}
    >
      <Text style={[fontStyle, { fontSize: fs, color: prefBorder, fontWeight: '600', textAlign: 'center' }]}>{label}</Text>
    </TouchableOpacity>
  );

  const PrefActionBtn = ({ label, bg, fg, onPress, isSave = false }) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{ backgroundColor: bg, borderRadius: dp(4), paddingVertical: isSave ? dp(5) : dp(4), paddingHorizontal: dp(6), width: '100%' }}
    >
      <Text style={[fontStyle, { fontSize: isSave ? prefFs : prefFs, color: fg, fontWeight: '700', textAlign: 'center' }]}>{label}</Text>
    </TouchableOpacity>
  );

  const Toggle = ({ value, onToggle, label: toggleLabel }) => (
    <TouchableOpacity
      onPress={onToggle}
      accessibilityLabel={toggleLabel}
      accessibilityHint={value ? 'Currently enabled. Double tap to disable.' : 'Currently disabled. Double tap to enable.'}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[styles.toggleTrack, { backgroundColor: value ? agreeColor : '#cccccc' }]}
    >
      <View style={[styles.toggleThumb, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
    </TouchableOpacity>
  );

  // ── Category accordion row ──
  const CatRow = ({ cat }) => {
    const isNec  = cat.key === 'necessary';
    const isOpen = expanded.has(cat.key);
    const togOn  = isNec ? true : (toggles[cat.key] ?? false);
    const catDps = getDpsForCat(cat.key);
    return (
      <View style={styles.catWrap}>
        <TouchableOpacity
          style={styles.catRow}
          accessibilityLabel={`${cat.label}. ${isOpen ? 'Collapse' : 'Expand'} details`}
          accessibilityRole="button"
          onPress={() => {
            const next = new Set(expanded);
            isOpen ? next.delete(cat.key) : next.add(cat.key);
            setExpanded(next);
          }}
        >
          <Text style={[fontStyle, { fontSize: prefArrowFs, color: agreeColor, transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }]}>▶</Text>
          <Text style={[fontStyle, { flex: 1, marginLeft: dp(6), fontSize: prefCatNameFs, fontWeight: '600', color: bodyColor }]}>
            {cat.label}
          </Text>
          {isNec ? (
            <Text style={[fontStyle, { fontSize: prefCatBodyFs, fontWeight: '600', color: agreeColor }]}>{alwaysActive}</Text>
          ) : (
            <Toggle
              value={togOn}
              label={`${cat.label} cookies`}
              onToggle={() => setToggles(t => ({ ...t, [cat.key]: !t[cat.key] }))}
            />
          )}
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.catBody}>
            <Text style={[fontStyle, { fontSize: prefCatBodyFs, color: bodyColor, opacity: 0.8, lineHeight: prefCatBodyFs * 1.5 }]}>
              {cat.desc}
            </Text>
            {/* Cookie Details link — same as default.js seers-cmp-cookie-policy-detail-btn */}
            {catDps.length > 0 && (
              <TouchableOpacity
                onPress={() => { setDpsCat(cat.key); setDpsSearch(''); setDpsView(true); }}
                accessibilityRole="button"
                style={{ marginTop: dp(6) }}
              >
                <Text style={[fontStyle, { fontSize: prefCatBodyFs, color: agreeColor, fontWeight: '600', textDecorationLine: 'underline' }]}>
                  {l?.cookie_details ?? 'Cookie Details'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const Logo = ({ containerStyle } = {}) => (
    showLogo ? (
      <View style={[{ alignItems: 'center', marginBottom: dp(6) }, containerStyle]}>
        <Image
          source={{ uri: logoSrc }}
          resizeMode="contain"
          style={{ width: dp(80), height: dp(28) }}
        />
      </View>
    ) : null
  );

  const BadgeGraphic = ({ size }) => (
    <Image
      source={{ uri: badgeUri }}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
  );

  // ─────────────────────────────────────────────────────────
  // POPUP — .consent-popup
  // ─────────────────────────────────────────────────────────
  const Popup = () => (
    <View style={[styles.sheetShadow, { backgroundColor: bgColor, padding: dp(12), ...popupRadius }]}>
      <Text style={[fontStyle, { fontSize: fs, color: bodyColor, opacity: 0.9, lineHeight: fs * 1.5 }]}>{bodyText}</Text>
      <View style={{ height: dp(7) }} />
      <StkPrimary label={btnAgree} onPress={() => save('agree', true, true, true)} />
      {allowReject && (
        <>
          <StkDark label={btnDecline} onPress={() => save('disagree', false, false, false)} />
          <View style={{ height: dp(5) }} />
        </>
      )}
      <StkOutline label={btnPref} onPress={() => { clearBannerTimer(); setShowPref(true); }} />
      {poweredBy && (
        <Text style={[fontStyle, { fontSize: fs * 0.7, color: '#aaaaaa', textAlign: 'center', marginTop: dp(3) }]}>
          Powered by Seers
        </Text>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // BOTTOM SHEET — .consent-sheet
  // ─────────────────────────────────────────────────────────
  const BottomSheet = () => (
    <View style={[styles.sheetShadowLight, { backgroundColor: bgColor, padding: dp(12), ...sheetRadius() }]}>
      {showHandle && <View style={styles.handle} />}
      <Text style={[fontStyle, { fontSize: titleFs, color: titleColor, fontWeight: '700', lineHeight: titleFs * 1.3 }]}>{titleText}</Text>
      <View style={{ height: dp(4) }} />
      <Text style={[fontStyle, { fontSize: fs, color: bodyColor, opacity: 0.9, lineHeight: fs * 1.5 }]}>{bodyText}</Text>
      <View style={{ height: dp(7) }} />
      <View style={{ flexDirection: 'row', gap: dp(4) }}>
        {allowReject && (
          <BtnItem label={btnDecline} bg={declineColor} fg={declineText} onPress={() => save('disagree', false, false, false)} />
        )}
        <BtnItem label={btnAgree} bg={agreeColor} fg={agreeText} onPress={() => save('agree', true, true, true)} />
      </View>
      <View style={{ height: dp(4) }} />
      <PrefFullBtn label={btnPref} onPress={() => { clearBannerTimer(); setShowPref(true); }} />
      {poweredBy && (
        <Text style={[fontStyle, { fontSize: fs * 0.7, color: '#aaaaaa', textAlign: 'center', marginTop: dp(3) }]}>
          Powered by Seers
        </Text>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // DIALOG — .consent-modal (centred)
  // ─────────────────────────────────────────────────────────
  const DialogBanner = () => (
    <View style={[styles.dialogShadow, { backgroundColor: bgColor, width: SCREEN_WIDTH * 0.88, padding: dp(12), ...dialogRadius() }]}>
      <Text style={[fontStyle, { fontSize: titleFs, color: titleColor, fontWeight: '700', lineHeight: titleFs * 1.3 }]}>{titleText}</Text>
      <View style={{ height: dp(4) }} />
      <Text style={[fontStyle, { fontSize: fs, color: bodyColor, opacity: 0.9, lineHeight: fs * 1.5 }]}>{bodyText}</Text>
      <View style={{ height: dp(8) }} />
      <StkPrimary label={btnAgree} onPress={() => save('agree', true, true, true)} />
      {allowReject && (
        <>
          <StkDark label={btnDecline} onPress={() => save('disagree', false, false, false)} />
          <View style={{ height: dp(5) }} />
        </>
      )}
      <StkOutline label={btnPref} onPress={() => { clearBannerTimer(); setShowPref(true); }} />
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // PREFERENCE PANEL — full-height sheet
  // ─────────────────────────────────────────────────────────
  const PrefPanel = () => (
    <View style={[styles.prefPanel, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={{ padding: dp(12), paddingBottom: dp(20) }}>
        <View style={styles.prefTopBar}>
          <View style={styles.prefTopLogo}>
            <Logo containerStyle={styles.prefLogoInner} />
          </View>
          <TouchableOpacity onPress={() => setShowPref(false)} style={styles.prefCloseButton}
            accessibilityLabel="Close preferences panel"
            accessibilityRole="button"
          >
            <Text style={[fontStyle, { fontSize: prefFs, color: titleColor, fontWeight: '700' }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={[fontStyle, { fontSize: prefTitleFs, fontWeight: '700', color: titleColor, lineHeight: prefTitleFs * 1.3 }]}>
          {aboutCookies}
        </Text>
        <View style={{ height: dp(4) }} />
        <Text style={[fontStyle, { fontSize: prefFs, color: bodyColor, opacity: 0.85, lineHeight: prefFs * 1.45 }]}>
          {bodyText}
        </Text>
        <View style={{ height: dp(4) }} />
        <Text style={[fontStyle, { fontSize: prefFs, fontWeight: '600', color: agreeColor, textDecorationLine: 'underline' }]}>
          Read Cookie Policy ↗
        </Text>
        <View style={{ height: dp(6) }} />
        <PrefActionBtn label={btnAgree} bg={agreeColor} fg={agreeText}
          onPress={() => save('agree', true, true, true)} />
        <View style={{ height: dp(4) }} />
        <PrefActionBtn label={btnDecline} bg='#1a1a2e' fg='#ffffff'
          onPress={() => save('disagree', false, false, false)} />
        <View style={{ height: dp(8) }} />
        <View style={{ borderTopWidth: 1, borderTopColor: '#e0e0e0', paddingTop: dp(4) }}>
          {cats.map(cat => <CatRow key={cat.key} cat={cat} />)}
        </View>
      </ScrollView>
      <View style={[styles.prefFooter, { backgroundColor: bgColor }]}>
        <PrefActionBtn
          label={btnSave}
          bg={agreeColor}
          fg={agreeText}
          isSave={true}
          onPress={() => save('custom', toggles.preferences, toggles.statistics, toggles.marketing)}
        />
      </View>
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // DPS DETAIL PANEL
  // Equivalent of default.js SeersCMPBannerCookieSearchContainer
  // Back button (← Cookie List) returns to preferences panel.
  // ─────────────────────────────────────────────────────────
  const DpsPanel = () => {
    const allDps   = getDpsForCat(dpsCat);
    const query    = dpsSearch.toLowerCase();
    const filtered = query
      ? allDps.filter(d =>
          (d.title ?? '').toLowerCase().includes(query) ||
          (d.provider ?? '').toLowerCase().includes(query)
        )
      : allDps;

    return (
      <View style={[styles.prefPanel, { backgroundColor: bgColor }]}>
        {/* Header: back + search — matches default.js SeersCMPBannerCookieSearchContainer */}
        <View style={[styles.dpsHeader, { backgroundColor: bgColor }]}>
          <TouchableOpacity
            onPress={() => setDpsView(false)}
            accessibilityRole="button"
            accessibilityLabel="Back to cookie list"
            style={styles.dpsBackBtn}
          >
            <Text style={{ fontSize: fs * 0.85, color: agreeColor, marginRight: 4 }}>‹</Text>
            <Text style={{ fontSize: fs, color: agreeColor, fontWeight: '600' }}>
              {l?.cookie_list ?? 'Cookie List'}
            </Text>
          </TouchableOpacity>
          {/* Search bar — matches default.js seers-cmp-search-bar */}
          <View style={styles.dpsSearchBar}>
            <Text style={{ fontSize: fs, color: '#aaa', marginRight: dp(4) }}>🔍</Text>
            <TextInput
              value={dpsSearch}
              onChangeText={setDpsSearch}
              placeholder="Cookie Search..."
              placeholderTextColor="#aaaaaa"
              style={{ flex: 1, fontSize: fs, color: bodyColor }}
            />
          </View>
        </View>

        {/* DPS list */}
        <ScrollView contentContainerStyle={{ padding: dp(12) }}>
          {filtered.length === 0 ? (
            <Text style={{ fontSize: fs, color: bodyColor, opacity: 0.5, textAlign: 'center', marginTop: dp(20) }}>
              No services found.
            </Text>
          ) : (
            filtered.map((dps, i) => (
              <View key={dps.id ?? i} style={styles.dpsRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ flex: 1, fontSize: fs, fontWeight: '600', color: bodyColor }}>{dps.title}</Text>
                  {!!dps.privacy_policy_url && (
                    <Text style={{ fontSize: fs - sp(1), color: agreeColor, textDecorationLine: 'underline' }}>
                      Privacy Policy
                    </Text>
                  )}
                </View>
                {!!dps.provider && (
                  <Text style={{ fontSize: fs - sp(1), color: bodyColor, opacity: 0.6, marginTop: dp(2) }}>
                    {dps.provider}
                  </Text>
                )}
                {!!dps.description && (
                  <Text style={{ fontSize: fs - sp(1), color: bodyColor, opacity: 0.75, lineHeight: (fs - sp(1)) * 1.4, marginTop: dp(4) }}>
                    {dps.description}
                  </Text>
                )}
                {!!dps.retention_period && (
                  <Text style={{ fontSize: fs - sp(1), color: bodyColor, opacity: 0.6, marginTop: dp(4) }}>
                    <Text style={{ fontWeight: '600' }}>Retention: </Text>{dps.retention_period}
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────
  // Root modal
  // ─────────────────────────────────────────────────────────
  if (showBadge && !showPref) {
    return (
      <View pointerEvents="box-none" style={styles.badgeOverlay}>
        <TouchableOpacity
          onPress={reopenBannerFromBadge}
          accessibilityLabel="Open cookie settings"
          accessibilityRole="button"
          style={styles.badgeButton}
        >
          <BadgeGraphic size={dp(34)} />
        </TouchableOpacity>
      </View>
    );
  }

  if (!showBanner && !showPref) {
    return null;
  }

  const isDialog = tmpl === 'dialog' && !showPref;
  const isTop    = tmpl === 'bottom_sheet' && position === 'top' && !showPref && !isDialog;

  return (
    <Modal transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[
        styles.overlay,
        isDialog && styles.overlayCenter,
        isTop    && styles.overlayTop,
      ]}>
        {showPref && !dpsView ? (
          <PrefPanel />
        ) : dpsView ? (
          <DpsPanel />
        ) : isDialog ? (
          <DialogBanner />
        ) : tmpl === 'bottom_sheet' ? (
          <BottomSheet />
        ) : (
          <Popup />
        )}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  overlayCenter: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // position=top: banner anchors to top of screen
  overlayTop: {
    justifyContent: 'flex-start',
  },
  // popup / bottom-sheet shadow
  sheetShadow: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetShadowLight: {
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  dialogShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 12,
  },
  // stk-btn: padding 5px 8px, margin-bottom 5px, font-weight:700, line-height:1.4
  stkBtn: {
    paddingVertical: dp(5),
    paddingHorizontal: dp(8),
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent',
  },
  stkBtnText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  // pref-toggle: 36×20, border-radius:12
  toggleTrack: {
    width: dp(36),
    height: dp(20),
    borderRadius: dp(12),
    padding: dp(2),
  },
  toggleThumb: {
    width: dp(16),
    height: dp(16),
    borderRadius: dp(8),
    backgroundColor: '#ffffff',
  },
  handle: {
    width: dp(32),
    height: dp(4),
    backgroundColor: '#cccccc',
    borderRadius: dp(2),
    alignSelf: 'center',
    marginBottom: dp(6),
  },
  catWrap: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: dp(5),
    marginBottom: dp(3),
    overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: dp(38),
    paddingHorizontal: dp(10),
    paddingVertical: dp(8),
  },
  catBody: {
    paddingHorizontal: dp(10),
    paddingTop: dp(8),
    paddingBottom: dp(9),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  prefPanel: {
    height: SCREEN_HEIGHT * 0.92,
    width: '100%',
    borderTopLeftRadius: dp(18),
    borderTopRightRadius: dp(18),
    overflow: 'hidden',
  },
  prefFooter: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: dp(12),
    paddingBottom: dp(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  prefTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: dp(2),
  },
  prefTopLogo: {
    flex: 1,
  },
  prefLogoInner: {
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  prefCloseButton: {
    marginLeft: dp(8),
  },
  badgeOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  badgeButton: {
    position: 'absolute',
    left: dp(12),
    bottom: dp(12),
    width: dp(34),
    height: dp(34),
  },
  // DPS detail panel styles — matches default.js SeersCMPBannerCookieSearchContainer
  dpsHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: dp(12),
    paddingTop: dp(12),
    paddingBottom: dp(8),
  },
  dpsBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: dp(8),
  },
  dpsSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: dp(6),
    borderWidth: 1,
    borderColor: '#DBDBDB',
    paddingHorizontal: dp(8),
    paddingVertical: dp(6),
  },
  dpsRow: {
    paddingVertical: dp(10),
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
});
