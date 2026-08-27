import React, { useState } from 'react';
import { View, ScrollView, Platform } from 'react-native';
import { Appbar, Portal, Dialog, Text, Button, useTheme, Surface } from 'react-native-paper';
import { PAGE_DOCS_REGISTRY } from './PageGuideDocs';
import { usePreferences } from '../contexts/PreferencesContext';

interface Props {
  pageKey: string;
}

export default function PageGuideButton({ pageKey }: Props) {
  const [visible, setVisible] = useState(false);
  const { language, isDarkMode } = usePreferences();
  const theme = useTheme();
  
  const doc = PAGE_DOCS_REGISTRY[pageKey];
  if (!doc) return null;

  const isBn = language === 'BN';
  const showModal = () => setVisible(true);
  const hideModal = () => setVisible(false);

  return (
    <>
      <Appbar.Action 
        icon="information-outline" 
        onPress={showModal} 
        color={theme.colors.primary}
        style={{ marginRight: -4 }}
      />
      
      <Portal>
        <Dialog visible={visible} onDismiss={hideModal} style={{ maxHeight: '80%', backgroundColor: theme.colors.surface }}>
          <Dialog.Title style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 22, marginRight: 8 }}>{doc.icon}</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 18, color: theme.colors.onSurface, flex: 1 }}>
              {isBn ? doc.title.bn : doc.title.en}
            </Text>
          </Dialog.Title>
          
          <Dialog.ScrollArea style={{ paddingHorizontal: 0 }}>
            <ScrollView contentContainerStyle={{ padding: 24 }}>
              {doc.badge && (
                <View style={{ alignSelf: 'flex-start', marginBottom: 12 }}>
                  <Surface style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16, backgroundColor: theme.colors.primaryContainer }}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>
                      {isBn ? doc.badge.bn : doc.badge.en}
                    </Text>
                  </Surface>
                </View>
              )}
              
              <Text style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#475569', marginBottom: 16 }}>
                {isBn ? doc.summary.bn : doc.summary.en}
              </Text>
              
              <Text style={{ fontWeight: 'bold', fontSize: 14, color: theme.colors.onSurface, marginBottom: 8 }}>
                {isBn ? 'কিভাবে কাজ করে:' : 'How to use:'}
              </Text>
              
              {(isBn ? doc.steps.bn : doc.steps.en).map((step: string, idx: number) => (
                <View key={idx} style={{ flexDirection: 'row', marginBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: theme.colors.primary, marginRight: 6 }}>•</Text>
                  <Text style={{ fontSize: 14, color: isDarkMode ? '#e2e8f0' : '#334155', flex: 1 }}>
                    {step}
                  </Text>
                </View>
              ))}
              
              {doc.tips && (
                <Surface style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.primary, marginBottom: 4 }}>
                    💡 {isBn ? 'টিপস' : 'Pro Tip'}
                  </Text>
                  <Text style={{ fontSize: 13, color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                    {isBn ? doc.tips.bn : doc.tips.en}
                  </Text>
                </Surface>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          
          <Dialog.Actions>
            <Button onPress={hideModal}>{isBn ? 'বুঝতে পেরেছি' : 'Got it'}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}
