import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { Appbar, Text, Card, TextInput, Button, useTheme, Chip, Surface } from 'react-native-paper';
import PageGuideButton from '../components/PageGuideButton';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useAuth } from '../contexts/AuthContext';
import { usePreferences } from '../contexts/PreferencesContext';

export default function BarcodesScreen() {
  const navigation = useNavigation<any>();
  const theme = useTheme();
  const { user } = useAuth();
  const { language, isDarkMode } = usePreferences();
  const isBN = language === 'BN';

  const shopPrefix = ((user as any)?.shop_barcode_prefix || '').toUpperCase();
  const [quantity, setQuantity] = useState<string>('10');
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleGenerate = () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0 || qty > 100) {
      Alert.alert(isBN ? 'সতর্কতা' : 'Warning', isBN ? '১ থেকে ১০০ এর মধ্যে পরিমাণ লিখুন।' : 'Please enter quantity between 1 and 100.');
      return;
    }

    const codes: string[] = [];
    const base = Date.now().toString().slice(-6);
    for (let i = 0; i < qty; i++) {
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      codes.push(`${shopPrefix}${base}${randomStr}${i}`);
    }
    setGeneratedCodes(codes);
  };

  const handlePrintLabels = async (singleCode?: string) => {
    const codesToPrint = singleCode ? [singleCode] : generatedCodes;
    if (codesToPrint.length === 0) return;
    setIsPrinting(true);

    try {
      let jsBarcodeScript = '';
      try {
        // Fetch JsBarcode script locally so it is synchronously available in the HTML without network issues in the print spooler
        const scriptRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js');
        jsBarcodeScript = await scriptRes.text();
      } catch (e) {
        console.warn('Failed to fetch jsbarcode', e);
        // Fallback to script tag if fetch fails
      }

      const labelsHtml = codesToPrint.map(code => `
        <div class="label">
          <div class="shop-name">${user?.shop_name || 'StockWhisk'}</div>
          <div class="code-box">
            <svg class="barcode" jsbarcode-format="CODE128" jsbarcode-value="${code}" jsbarcode-textmargin="0" jsbarcode-fontoptions="bold"></svg>
          </div>
          <div class="code-text">${code}</div>
        </div>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${jsBarcodeScript ? `<script>${jsBarcodeScript}</script>` : `<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js"></script>`}
          <style>
            @page {
              size: 38mm 25mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: monospace, sans-serif;
              background: white;
            }
            .label {
              width: 38mm;
              height: 25mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              page-break-after: always;
              box-sizing: border-box;
              padding: 1mm;
              text-align: center;
              overflow: hidden;
            }
            .shop-name {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 1mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 36mm;
            }
            .code-text {
              font-size: 10px;
              font-weight: bold;
              letter-spacing: 1px;
              margin-top: 1mm;
            }
            svg {
              max-width: 36mm;
              height: 12mm;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              if (typeof JsBarcode !== 'undefined') {
                JsBarcode(".barcode").init();
              }
            };
            // Fallback just in case onload already fired or we injected the script synchronously
            if (typeof JsBarcode !== 'undefined') {
               try { JsBarcode(".barcode").init(); } catch(e) {}
            }
          </script>
        </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.width = '0px';
        iframe.style.height = '0px';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }, 1000); // Give JSBarcode time to render
        }
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert(isBN ? 'ত্রুটি' : 'Error', isBN ? 'বারকোড লেবেল প্রিন্ট করতে ব্যর্থ হয়েছে।' : 'Failed to print barcode labels.');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'বারকোড জেনারেটর ও প্রিন্টার' : 'Barcode Generator'} titleStyle={{ fontWeight: 'bold' }} />
        <PageGuideButton pageKey="/app/barcodes" />
      </Appbar.Header>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Controls Card */}
        <Card style={{ backgroundColor: theme.colors.surface, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <MaterialCommunityIcons name="barcode-scan" size={24} color="#4f46e5" style={{ marginRight: 8 }} />
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
              {isBN ? 'স্টিকার বারকোড তৈরি করুন' : 'Generate Barcode Stickers'}
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
            {isBN 
              ? 'আপনার পণ্যের গায়ে লাগানোর জন্য ৩৮×২৫ মিমি সাইজের বারকোড স্টিকার প্রিন্ট করুন।' 
              : 'Generate and print 38mm × 25mm barcode label stickers for your inventory.'}
          </Text>

          {!!shopPrefix && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, backgroundColor: '#eff6ff', padding: 10, borderRadius: 8 }}>
              <Text style={{ fontSize: 13, color: '#1e40af', marginRight: 6 }}>
                {isBN ? 'শপ প্রিফিক্স:' : 'Shop Prefix:'}
              </Text>
              <View style={{ backgroundColor: '#2563eb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12, includeFontPadding: false }}>
                  {shopPrefix}
                </Text>
              </View>
            </View>
          )}

          <TextInput
            mode="outlined"
            label={isBN ? 'স্টিকার সংখ্যা (Quantity)' : 'Sticker Quantity'}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            style={{ backgroundColor: theme.colors.surface, marginBottom: 14 }}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['1', '5', '10', '20', '50'].map(q => {
              const isSelected = quantity === q;
              return (
                <TouchableOpacity 
                  key={q} 
                  onPress={() => setQuantity(q)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? '#4f46e5' : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                    borderWidth: 1,
                    borderColor: isSelected ? '#4f46e5' : (isDarkMode ? '#334155' : '#cbd5e1'),
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: isSelected ? 'bold' : '600',
                    color: isSelected ? '#ffffff' : (isDarkMode ? '#cbd5e1' : '#475569'),
                    includeFontPadding: false,
                    textAlign: 'center',
                  }}>
                    {q} {isBN ? 'টি' : 'pcs'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            mode="contained"
            buttonColor="#4f46e5"
            icon="cog-sync"
            onPress={handleGenerate}
          >
            {isBN ? 'বারকোড তৈরি করুন' : 'Generate Barcodes'}
          </Button>
        </Card>

        {/* Generated Codes List */}
        {generatedCodes.length > 0 && (
          <View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                {isBN ? `উৎপন্ন বারকোড (${generatedCodes.length}টি)` : `Generated Barcodes (${generatedCodes.length})`}
              </Text>
              <Button
                mode="contained"
                buttonColor="#16a34a"
                icon="printer"
                compact
                loading={isPrinting}
                disabled={isPrinting}
                onPress={() => handlePrintLabels()}
              >
                {isBN ? 'সবগুলো প্রিন্ট' : 'Print All'}
              </Button>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {generatedCodes.map((code, index) => (
                <TouchableOpacity
                  key={index}
                  style={{ width: '48%' }}
                  activeOpacity={0.7}
                  onPress={() => handlePrintLabels(code)}
                >
                  <Surface
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      backgroundColor: theme.colors.surface,
                      borderWidth: 1,
                      borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
                      alignItems: 'center',
                      position: 'relative'
                    }}
                    elevation={1}
                  >
                    <MaterialCommunityIcons name="printer" size={16} color="#16a34a" style={{ position: 'absolute', top: 6, right: 6 }} />
                    <MaterialCommunityIcons name="barcode" size={32} color="#4f46e5" />
                    <Text style={{ fontWeight: 'bold', fontSize: 12, marginTop: 4 }}>
                      {code}
                    </Text>
                  </Surface>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
