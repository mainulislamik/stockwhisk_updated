import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { AppColors } from '../constants/theme';

export default function SubscriptionBlockedModal() {
  const { user, billing, logout, loadUser } = useAuth();
  const { isDarkMode, language } = usePreferences();
  const [refreshing, setRefreshing] = useState(false);

  const isBn = language === 'BN';
  const shopName = user?.shop_name || (isBn ? 'আপনার দোকান' : 'Your Store');
  const shopCode = user?.shop_code || '';
  const hotline = billing?.billing_details?.hotline || '01613511887';
  const bkash = billing?.billing_details?.bkash || '01613511887';
  const nagad = billing?.billing_details?.nagad || '01613511887';

  const handleCall = () => {
    Linking.openURL(`tel:${hotline}`);
  };

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `আসসালামু আলাইকুম, আমি ${shopName}${shopCode ? ` (ID: ${shopCode})` : ''} থেকে বলছি। আমার স্টকহুইস্ক সাবস্ক্রিপশন রিনিউ করতে চাই।`
    );
    Linking.openURL(`https://wa.me/88${hotline.replace(/[^0-9]/g, '')}?text=${text}`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadUser();
    } finally {
      setRefreshing(false);
    }
  };

  const bgContainer = isDarkMode ? '#090d16' : '#f8fafc';
  const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
  const cardBorder = isDarkMode ? '#334155' : '#e2e8f0';
  const titleColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const subtitleColor = isDarkMode ? '#cbd5e1' : '#475569';
  const textMuted = isDarkMode ? '#94a3b8' : '#64748b';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgContainer }]} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.cardWrapper}>
          {/* Warning Icon Badge */}
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="shield-alert-outline" size={44} color="#ef4444" />
          </View>

          {/* Status Pill Badge */}
          <View style={styles.statusBadge}>
            <MaterialCommunityIcons name="lock-alert" size={14} color="#ffffff" style={{ marginRight: 5 }} />
            <Text style={styles.statusText}>
              {isBn ? 'স্থগিত · SUSPENDED' : 'EXPIRED · SUSPENDED'}
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: titleColor }]}>
            {isBn ? 'দোকানের এক্সেস স্থগিত করা হয়েছে' : 'Store Access Suspended'}
          </Text>

          {/* Subtitle Description */}
          <Text style={[styles.subtitle, { color: subtitleColor }]}>
            {isBn
              ? `শ্রদ্ধেয় গ্রাহক, আপনার প্রতিষ্ঠান "${shopName}"-এর সাবস্ক্রিপশন বা প্যাকেজের মেয়াদ উত্তীর্ণ হওয়ায় সফটওয়্যার এক্সেস সাময়িকভাবে বন্ধ রয়েছে।`
              : `Dear merchant, subscription for "${shopName}" has expired and store access is currently locked.`}
          </Text>

          {/* Support & Action Buttons */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={[styles.btn, styles.callBtn]}
              onPress={handleCall}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="phone" size={20} color="#ffffff" style={styles.btnIcon} />
              <Text style={styles.btnText} numberOfLines={1}>
                {isBn ? `সরাসরি কল করুন (${hotline})` : `Call Support (${hotline})`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.waBtn]}
              onPress={handleWhatsApp}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="whatsapp" size={20} color="#ffffff" style={styles.btnIcon} />
              <Text style={styles.btnText} numberOfLines={1}>
                {isBn ? 'হোয়াটসঅ্যাপে মেসেজ পাঠান' : 'Chat on WhatsApp'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payment & Renewal Info Card */}
          <View style={[styles.infoCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={styles.infoTitleRow}>
              <MaterialCommunityIcons name="credit-card-outline" size={18} color={AppColors.primary} />
              <Text style={[styles.infoTitle, { color: titleColor }]}>
                {isBn ? 'সাবস্ক্রিপশন নবায়ন করার নিয়মাবলী:' : 'Renewal & Payment Guide:'}
              </Text>
            </View>

            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: textMuted }]}>bKash / Nagad:</Text>
              <TouchableOpacity onPress={handleCall} activeOpacity={0.7} style={styles.valPill}>
                <Text style={[styles.paymentVal, { color: isDarkMode ? '#38bdf8' : '#0284c7' }]}>{bkash}</Text>
                <MaterialCommunityIcons name="phone-outgoing" size={14} color={isDarkMode ? '#38bdf8' : '#0284c7'} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            {shopCode ? (
              <View style={styles.paymentRow}>
                <Text style={[styles.paymentLabel, { color: textMuted }]}>Reference ID:</Text>
                <View style={[styles.codeBadge, { backgroundColor: isDarkMode ? '#312e81' : '#ede9fe' }]}>
                  <Text style={[styles.codeBadgeText, { color: isDarkMode ? '#c7d2fe' : '#6366f1' }]}>{shopCode}</Text>
                </View>
              </View>
            ) : null}

            <Text style={[styles.infoHint, { color: textMuted }]}>
              {isBn
                ? 'বিকাশ বা নগদ থেকে ফি পাঠিয়ে উপরের নম্বরে কল দিন বা হোয়াটসঅ্যাপে জানান। কয়েক মিনিটের মধ্যে আপনার দোকান পুনরায় চালু করে দেওয়া হবে।'
                : 'Send renewal fee via bKash/Nagad and notify our hotline. Your store will be reactivated immediately.'}
            </Text>
          </View>

          {/* Secondary Actions: Refresh and Logout */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[
                styles.smallBtn,
                {
                  backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                  borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                },
              ]}
              onPress={handleRefresh}
              disabled={refreshing}
              activeOpacity={0.7}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={AppColors.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="refresh" size={16} color={titleColor} />
                  <Text style={[styles.smallBtnText, { color: titleColor }]}>
                    {isBn ? 'স্ট্যাটাস যাচাই' : 'Refresh'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.smallBtn, styles.logoutBtn]}
              onPress={logout}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="logout" size={16} color="#ef4444" />
              <Text style={[styles.smallBtnText, { color: '#ef4444' }]}>
                {isBn ? 'লগআউট' : 'Logout'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  iconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: '#fca5a5',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  btn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  callBtn: {
    backgroundColor: '#2563eb',
  },
  waBtn: {
    backgroundColor: '#16a34a',
  },
  btnIcon: {
    marginRight: 8,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  infoCard: {
    width: '100%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 4,
  },
  paymentLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  valPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentVal: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  codeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  codeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoHint: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  smallBtn: {
    flex: 1,
    maxWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  smallBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
