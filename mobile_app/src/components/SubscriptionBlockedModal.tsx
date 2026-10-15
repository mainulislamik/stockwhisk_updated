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

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#090d16' : '#f8fafc' }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Warning Icon Badge */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="shield-alert-outline" size={48} color="#ef4444" />
        </View>

        {/* Title & Badge */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {isBn ? 'স্থগিত · SUSPENDED' : 'EXPIRED · SUSPENDED'}
          </Text>
        </View>

        <Text style={[styles.title, { color: isDarkMode ? '#f8fafc' : '#0f172a' }]}>
          {isBn ? 'দোকানের এক্সেস স্থগিত করা হয়েছে' : 'Store Access Suspended'}
        </Text>

        <Text style={[styles.subtitle, { color: isDarkMode ? '#cbd5e1' : '#334155' }]}>
          {isBn
            ? `শ্রদ্ধেয় গ্রাহক, আপনার প্রতিষ্ঠান "${shopName}"-এর সাবস্ক্রিপশন বা প্যাকেজের মেয়াদ উত্তীর্ণ হওয়ায় সফটওয়্যার এক্সেস সাময়িকভাবে বন্ধ রয়েছে।`
            : `Dear merchant, subscription for "${shopName}" has expired and store access is currently locked.`}
        </Text>

        {/* Support & Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={[styles.btn, styles.callBtn]} onPress={handleCall} activeOpacity={0.8}>
            <MaterialCommunityIcons name="phone" size={20} color="#ffffff" style={styles.btnIcon} />
            <Text style={styles.btnText}>
              {isBn ? `সরাসরি কল করুন (${hotline})` : `Call Support (${hotline})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.waBtn]} onPress={handleWhatsApp} activeOpacity={0.8}>
            <MaterialCommunityIcons name="whatsapp" size={20} color="#ffffff" style={styles.btnIcon} />
            <Text style={styles.btnText}>
              {isBn ? 'হোয়াটসঅ্যাপে মেসেজ পাঠান' : 'Chat on WhatsApp'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Payment & Renewal Info Card */}
        <View style={[styles.infoCard, { backgroundColor: isDarkMode ? '#1e293b' : '#ffffff', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
          <View style={styles.infoTitleRow}>
            <MaterialCommunityIcons name="credit-card-outline" size={18} color={AppColors.primary} />
            <Text style={[styles.infoTitle, { color: isDarkMode ? '#f1f5f9' : '#0f172a' }]}>
              {isBn ? 'সাবস্ক্রিপশন নবায়ন করার নিয়মাবলী:' : 'Renewal & Payment Guide:'}
            </Text>
          </View>

          <View style={styles.paymentRow}>
            <Text style={[styles.paymentLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>bKash / Nagad:</Text>
            <Text style={[styles.paymentVal, { color: isDarkMode ? '#38bdf8' : '#0284c7' }]}>{bkash}</Text>
          </View>
          {shopCode ? (
            <View style={styles.paymentRow}>
              <Text style={[styles.paymentLabel, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>Reference ID:</Text>
              <Text style={[styles.paymentVal, { color: isDarkMode ? '#a855f7' : '#7c3aed' }]}>{shopCode}</Text>
            </View>
          ) : null}

          <Text style={[styles.infoHint, { color: isDarkMode ? '#94a3b8' : '#64748b' }]}>
            {isBn
              ? 'বিকাশ বা নগদ থেকে ফি পাঠিয়ে উপরের নম্বরে কল দিন বা হোয়াটসঅ্যাপে জানান। কয়েক মিনিটের মধ্যে আপনার দোকান পুনরায় চালু করে দেওয়া হবে।'
              : 'Send renewal fee via bKash/Nagad and notify our hotline. Your store will be reactivated immediately.'}
          </Text>
        </View>

        {/* Secondary Actions: Refresh and Logout */}
        <View style={styles.footerRow}>
          <TouchableOpacity
            style={[styles.smallBtn, { backgroundColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}
            onPress={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={AppColors.primary} />
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={16} color={isDarkMode ? '#f8fafc' : '#334155'} />
                <Text style={[styles.smallBtnText, { color: isDarkMode ? '#f8fafc' : '#334155' }]}>
                  {isBn ? 'স্ট্যাটাস যাচাই' : 'Refresh'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.smallBtn, styles.logoutBtn]}
            onPress={logout}
          >
            <MaterialCommunityIcons name="logout" size={16} color="#ef4444" />
            <Text style={[styles.smallBtnText, { color: '#ef4444' }]}>
              {isBn ? 'লগআউট' : 'Logout'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 99999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    maxWidth: 480,
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 12,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
    fontSize: 15,
    fontWeight: 'bold',
  },
  infoCard: {
    width: '100%',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paymentLabel: {
    fontSize: 12,
  },
  paymentVal: {
    fontSize: 13,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoHint: {
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
  },
  smallBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
