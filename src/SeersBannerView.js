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

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import SeersCMP from './index';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// Scale factor: maps Vue's 190px preview frame to real screen width.
// e.g. 360dp phone → scale=1.89, 414dp phone → scale=2.0 (capped)
const PREVIEW_WIDTH = 190;
const scale = Math.min(SCREEN_WIDTH / PREVIEW_WIDTH, 2.0);
const sp  = (px) => Math.round(px * scale); // font sizes
const dp  = (px) => Math.round(px * scale); // paddings / spacing

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function hex(str) {
  if (!str || str === 'transparent') return 'transparent';
  return str.startsWith('#') ? str : `#${str}`;
}

// ─────────────────────────────────────────────────────────────
// SeersBannerView
// ─────────────────────────────────────────────────────────────

export default function SeersBannerView({ payload, onDismiss }) {
  const [showPref, setShowPref]   = useState(false);
  const [toggles, setToggles]     = useState({ preferences: true, statistics: false, marketing: false });
  const [expanded, setExpanded]   = useState(new Set());

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
  const fs      = sp(parseFloat(b?.font_size) || 14);
  const titleFs = fs + sp(2);

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

  // ── Container radius — matches Flutter _radius() exactly ──
  const containerRadius = () => {
    if (tmpl === 'dialog') {
      if (layout === 'rounded') return { borderRadius: 20 };
      if (layout === 'flat')    return { borderRadius: 0 };
      return { borderRadius: 10 };
    }
    if (layout === 'flat') return { borderRadius: 0 };
    if (layout === 'rounded') return position === 'top'
      ? { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }
      : { borderTopLeftRadius:    16, borderTopRightRadius:    16 };
    // default
    if (position === 'top') return { borderBottomLeftRadius: 14, borderBottomRightRadius: 14 };
    return { borderTopLeftRadius: 12, borderTopRightRadius: 12 };
  };

  // ── Save consent ──
  const save = async (value, pref, stat, mkt) => {
    await SeersCMP.saveConsent({ value, preferences: pref, statistics: stat, marketing: mkt });
    onDismiss();
  };

  // ─────────────────────────────────────────────────────────
  // Buttons — exact CSS match to Flutter
  // ─────────────────────────────────────────────────────────

  // stk-outline: transparent bg, 1.5px border, body_text_color
  const StkOutline = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.stkBtn, { borderWidth: 1.5, borderColor: prefBorder, borderRadius: btnRadius }]}
    >
      <Text style={[styles.stkBtnText, { fontSize: fs, color: prefBorder }]}>{label}</Text>
    </TouchableOpacity>
  );

  const StkDark = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.stkBtn, { backgroundColor: declineColor, borderRadius: btnRadius, marginBottom: dp(5) }]}
    >
      <Text style={[styles.stkBtnText, { fontSize: fs, color: declineText }]}>{label}</Text>
    </TouchableOpacity>
  );

  const StkPrimary = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.stkBtn, {
        backgroundColor: isStroke ? 'transparent' : agreeColor,
        borderWidth: isStroke ? 1 : 0, borderColor: agreeColor,
        borderRadius: btnRadius,
        marginBottom: dp(5),
      }]}
    >
      <Text style={[styles.stkBtnText, { fontSize: fs, color: isStroke ? agreeColor : agreeText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const BtnItem = ({ label, bg, fg, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, backgroundColor: bg, borderRadius: btnRadius, padding: dp(4), alignItems: 'center' }}
    >
      <Text style={{ fontSize: fs, color: fg, fontWeight: '600' }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  const PrefFullBtn = ({ label, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{
        borderWidth: 1, borderColor: prefBorder, borderRadius: btnRadius,
        paddingVertical: dp(4), paddingHorizontal: dp(6), marginBottom: dp(3),
        width: '100%', alignItems: 'center', backgroundColor: 'transparent',
      }}
    >
      <Text style={{ fontSize: fs, color: prefBorder, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );

  const PrefActionBtn = ({ label, bg, fg, onPress, isSave = false }) => (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: bg, borderRadius: dp(4), paddingVertical: isSave ? dp(5) : dp(4), paddingHorizontal: dp(6), width: '100%' }}
    >
      <Text style={{ fontSize: fs, color: fg, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </TouchableOpacity>
  );

  // ── Toggle ──
  const Toggle = ({ value, onToggle }) => (
    <TouchableOpacity
      onPress={onToggle}
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
    return (
      <View style={styles.catWrap}>
        <TouchableOpacity
          style={styles.catRow}
          onPress={() => {
            const next = new Set(expanded);
            isOpen ? next.delete(cat.key) : next.add(cat.key);
            setExpanded(next);
          }}
        >
          {/* Arrow — rotates 90° when open */}
          <Text style={{ fontSize: fs * 0.75, color: agreeColor, transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}>▶</Text>
          <Text style={{ flex: 1, marginLeft: dp(3), fontSize: fs + sp(1), fontWeight: '600', color: bodyColor }}>
            {cat.label}
          </Text>
          {isNec ? (
            <Text style={{ fontSize: fs, fontWeight: '600', color: agreeColor }}>{alwaysActive}</Text>
          ) : (
            <Toggle value={togOn} onToggle={() => setToggles(t => ({ ...t, [cat.key]: !t[cat.key] }))} />
          )}
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.catBody}>
            <Text style={{ fontSize: fs - sp(1), color: bodyColor, opacity: 0.8, lineHeight: (fs - sp(1)) * 1.5 }}>
              {cat.desc}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────
  // POPUP — .consent-popup
  // ─────────────────────────────────────────────────────────
  const Popup = () => (
    <View style={[styles.sheetShadow, { backgroundColor: bgColor, padding: dp(12), ...containerRadius() }]}>
      <Text style={{ fontSize: fs, color: bodyColor, opacity: 0.9, lineHeight: fs * 1.5 }}>{bodyText}</Text>
      <View style={{ height: dp(7) }} />
      <StkPrimary label={btnAgree} onPress={() => save('agree', true, true, true)} />
      {allowReject && (
        <>
          <StkDark label={btnDecline} onPress={() => save('disagree', false, false, false)} />
          <View style={{ height: dp(5) }} />
        </>
      )}
      <StkOutline label={btnPref} onPress={() => setShowPref(true)} />
      {poweredBy && (
        <Text style={{ fontSize: fs * 0.7, color: '#aaaaaa', textAlign: 'center', marginTop: dp(3) }}>
          Powered by Seers
        </Text>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // BOTTOM SHEET — .consent-sheet
  // ─────────────────────────────────────────────────────────
  const BottomSheet = () => (
    <View style={[styles.sheetShadowLight, { backgroundColor: bgColor, padding: dp(12), ...containerRadius() }]}>
      {showHandle && <View style={styles.handle} />}
      <Text style={{ fontSize: titleFs, color: titleColor, fontWeight: '700', lineHeight: titleFs * 1.3 }}>{titleText}</Text>
      <View style={{ height: dp(4) }} />
      <Text style={{ fontSize: fs, color: bodyColor, opacity: 0.9, lineHeight: fs * 1.5 }}>{bodyText}</Text>
      <View style={{ height: dp(7) }} />
      <View style={{ flexDirection: 'row', gap: dp(4) }}>
        {allowReject && (
          <BtnItem label={btnDecline} bg={declineColor} fg={declineText} onPress={() => save('disagree', false, false, false)} />
        )}
        <BtnItem label={btnAgree} bg={agreeColor} fg={agreeText} onPress={() => save('agree', true, true, true)} />
      </View>
      <View style={{ height: dp(4) }} />
      <PrefFullBtn label={btnPref} onPress={() => setShowPref(true)} />
      {poweredBy && (
        <Text style={{ fontSize: fs * 0.7, color: '#aaaaaa', textAlign: 'center', marginTop: dp(3) }}>
          Powered by Seers
        </Text>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // DIALOG — .consent-modal (centred)
  // ─────────────────────────────────────────────────────────
  const DialogBanner = () => (
    <View style={[styles.dialogShadow, { backgroundColor: bgColor, width: SCREEN_WIDTH * 0.88, padding: dp(12), ...containerRadius() }]}>
      <Text style={{ fontSize: titleFs, color: titleColor, fontWeight: '700', lineHeight: titleFs * 1.3 }}>{titleText}</Text>
      <View style={{ height: dp(4) }} />
      <Text style={{ fontSize: fs, color: bodyColor, opacity: 0.9, lineHeight: fs * 1.5 }}>{bodyText}</Text>
      <View style={{ height: dp(8) }} />
      <StkPrimary label={btnAgree} onPress={() => save('agree', true, true, true)} />
      {allowReject && (
        <>
          <StkDark label={btnDecline} onPress={() => save('disagree', false, false, false)} />
          <View style={{ height: dp(5) }} />
        </>
      )}
      <StkOutline label={btnPref} onPress={() => setShowPref(true)} />
    </View>
  );

  // ─────────────────────────────────────────────────────────
  // PREFERENCE PANEL — full-height sheet
  // ─────────────────────────────────────────────────────────
  const PrefPanel = () => (
    <View style={[styles.prefPanel, { backgroundColor: bgColor }]}>
      <ScrollView contentContainerStyle={{ padding: dp(12), paddingBottom: dp(20) }}>
        <TouchableOpacity onPress={onDismiss} style={{ alignSelf: 'flex-end', marginBottom: dp(2) }}>
          <Text style={{ fontSize: fs, color: titleColor, fontWeight: '700' }}>✕</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: titleFs, fontWeight: '700', color: titleColor, lineHeight: titleFs * 1.3 }}>
          {aboutCookies}
        </Text>
        <View style={{ height: dp(4) }} />
        <Text style={{ fontSize: fs, color: bodyColor, opacity: 0.85, lineHeight: fs * 1.4 }}>
          {bodyText}
        </Text>
        <View style={{ height: dp(4) }} />
        <Text style={{ fontSize: fs, fontWeight: '600', color: agreeColor, textDecorationLine: 'underline' }}>
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
  // Root modal
  // ─────────────────────────────────────────────────────────
  const isDialog = tmpl === 'dialog' && !showPref;
  const isTop     = position === 'top' && !showPref && !isDialog;

  return (
    <Modal transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={[
        styles.overlay,
        isDialog && styles.overlayCenter,
        isTop    && styles.overlayTop,
      ]}>
        {showPref ? (
          <PrefPanel />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
    paddingHorizontal: dp(5),
    paddingVertical: dp(4),
  },
  catBody: {
    paddingHorizontal: dp(7),
    paddingTop: dp(3),
    paddingBottom: dp(4),
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  prefPanel: {
    height: SCREEN_HEIGHT * 0.88,
    borderTopLeftRadius: dp(16),
    borderTopRightRadius: dp(16),
    overflow: 'hidden',
    width: '100%',
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
});