import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Linking, Dimensions } from 'react-native';
import { Text, Appbar, useTheme, Card, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';
import { usePreferences } from '../contexts/PreferencesContext';
import YoutubePlayer from 'react-native-youtube-iframe';

export default function TutorialsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { language } = usePreferences();
  const isBN = language === 'BN';
  
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<any>(null);

  useEffect(() => {
    fetchTutorials();
  }, []);

  const fetchTutorials = async () => {
    try {
      const res = await api.get('/tutorials/');
      if (res.data && Array.isArray(res.data)) {
        setVideos(res.data);
        if (res.data.length > 0) {
          setActiveVideo(res.data[0]);
        }
      }
    } catch (error) {
      console.log('Error fetching tutorials:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Appbar.Header statusBarHeight={0} style={{ backgroundColor: theme.colors.surface, elevation: 1 }}>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={isBN ? 'ভিডিও টিউটোরিয়াল' : 'Video Tutorials'} />
      </Appbar.Header>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {activeVideo && (
            <View style={{ marginBottom: 24, borderRadius: 12, overflow: 'hidden' }}>
              <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' }}>
                {Platform.OS === 'web' ? (
                  <iframe
                    src={activeVideo.embed_url || (activeVideo.video_id ? `https://www.youtube.com/embed/${activeVideo.video_id}` : '')}
                    style={{ border: 0, width: '100%', height: '100%' }}
                    allowFullScreen
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  />
                ) : (
                  <YoutubePlayer
                    height={(Dimensions.get('window').width - 32) * (9 / 16)}
                    videoId={activeVideo.video_id || (activeVideo.youtube_url ? activeVideo.youtube_url.split('v=')[1]?.split('&')[0] : '')}
                    play={false}
                    webViewStyle={{ flex: 1 }}
                    webViewProps={{
                      androidLayerType: 'software',
                      allowsFullscreenVideo: true,
                    }}
                  />
                )}
              </View>
              <View style={{ paddingVertical: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {activeVideo.sequence}. {activeVideo.title}
                </Text>
                <Button
                  mode="outlined"
                  icon="youtube"
                  textColor="#dc2626"
                  style={{ borderColor: '#dc2626', marginTop: 10, alignSelf: 'flex-start' }}
                  onPress={() => {
                    const url = activeVideo.youtube_url || (activeVideo.video_id ? `https://www.youtube.com/watch?v=${activeVideo.video_id}` : '');
                    if (url) Linking.openURL(url);
                  }}
                >
                  {isBN ? 'ইউটিউবে দেখুন' : 'Watch on YouTube'}
                </Button>
              </View>
            </View>
          )}

          {videos.length > 0 ? (
            <View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: theme.colors.secondary }}>
                {isBN ? 'অন্যান্য টিউটোরিয়াল' : 'More Tutorials'}
              </Text>
              {videos.filter((v) => v.id !== activeVideo?.id).map((video) => (
                <TouchableOpacity 
                  key={video.id} 
                  onPress={() => setActiveVideo(video)}
                  style={{ marginBottom: 12 }}
                  activeOpacity={0.7}
                >
                  <Card style={{ backgroundColor: theme.colors.surface }}>
                    <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                        <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>{video.sequence}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{video.title}</Text>
                      </View>
                    </Card.Content>
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 40, padding: 20 }}>
              <Text style={{ textAlign: 'center', marginTop: 12, marginBottom: 16, color: theme.colors.outline }}>
                {isBN ? 'কোনো ভিডিও টিউটোরিয়াল পাওয়া যায়নি বা ইন্টারনেট সংযোগ বিচ্ছিন্ন।' : 'No tutorials found or network error.'}
              </Text>
              <Button mode="contained" onPress={() => { setLoading(true); fetchTutorials(); }}>
                {isBN ? 'পুনরায় চেষ্টা করুন' : 'Retry'}
              </Button>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
