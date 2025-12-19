import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/firebase/config';

export default function EditPostScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [post, setPost] = useState({
    title: '',
    content: '',
    postType: 'Рецепты',
    images: [] as string[],
  });

  useEffect(() => {
    loadPost();
  }, []);

  const loadPost = async () => {
    try {
      const postId = params.postId as string;
      if (!postId) {
        Alert.alert('Ошибка', 'ID поста не указан');
        router.back();
        return;
      }

      const docRef = doc(db, 'community_posts', postId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setPost({
          title: params.title as string || data.title,
          content: params.content as string || data.content,
          postType: params.postType as string || data.postType,
          images: params.images ? JSON.parse(params.images as string) : data.images || [],
        });
      }
    } catch (error) {
      console.error('Ошибка загрузки поста:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить пост');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!post.title.trim() || !post.content.trim()) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }

    try {
      setSaving(true);
      const postId = params.postId as string;
      const docRef = doc(db, 'community_posts', postId);

      await updateDoc(docRef, {
        title: post.title,
        content: post.content,
        postType: post.postType,
        updatedAt: new Date(),
      });

      Alert.alert('Успешно', 'Пост обновлен', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      Alert.alert('Ошибка', 'Не удалось обновить пост');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6A9AA9" />
        <Text style={styles.loadingText}>Загрузка...</Text>
      </View>
    );
  }

  const filters = ['Рецепты', 'Вопросы', 'Отзывы', 'Советы'];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Редактировать пост</Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Text style={styles.saveButtonText}>Сохранить</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Тип поста</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeButton,
                post.postType === type && styles.typeButtonActive,
              ]}
              onPress={() => setPost({ ...post, postType: type })}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  post.postType === type && styles.typeButtonTextActive,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>Заголовок</Text>
        <TextInput
          style={styles.input}
          value={post.title}
          onChangeText={(text) => setPost({ ...post, title: text })}
          placeholder="Введите заголовок"
        />

        <Text style={styles.label}>Содержание</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={post.content}
          onChangeText={(text) => setPost({ ...post, content: text })}
          placeholder="Введите текст поста"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />

        {post.images.length > 0 && (
          <>
            <Text style={styles.label}>Фото ({post.images.length})</Text>
            <View style={styles.imagesContainer}>
              {post.images.map((image, index) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ))}
            </View>
            <Text style={styles.imagesNote}>
              Примечание: чтобы изменить фото, удалите пост и создайте новый
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6A9AA9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'Playfair Display Bold',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#9BDF11',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Playfair Display Regular',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    marginTop: 16,
    fontFamily: 'Playfair Display Regular',
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6A9AA9',
    marginRight: 8,
    backgroundColor: '#fff',
  },
  typeButtonActive: {
    backgroundColor: '#9BDF11',
    borderColor: '#9BDF11',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Playfair Display Regular',
  },
  typeButtonTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  input: {
    borderWidth: 2,
    borderColor: '#6A9AA9',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    fontFamily: 'Playfair Display Regular',
  },
  textArea: {
    height: 150,
    textAlignVertical: 'top',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  imagesNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    fontFamily: 'Playfair Display Regular',
  },
});