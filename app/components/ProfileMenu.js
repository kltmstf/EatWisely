// components/ProfileMenu.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuthContext } from '@/app/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const ProfileMenu = ({ visible, onClose, userName = "Пользователь" }) => {
  const router = useRouter();
  const { signOut, user } = useAuthContext(); // Убрал deleteUserAccount

  const isAuthenticated = !!user;

  const handleMenuAction = async (action) => {
    onClose();

    switch (action) {
      case 'profile':
        if (isAuthenticated) {
          router.push('/profile');
        } else {
          router.push('/login');
        }
        break;

      case 'settings':
        if (isAuthenticated) {
          router.push('/profile-settings');
        } else {
          router.push('/login');
        }
        break;

      case 'login':
        router.push('/login');
        break;

      case 'register':
        router.push('/register');
        break;

      case 'logout':
        try {
          await signOut();
          console.log('Выход из аккаунта выполнен');
          router.replace('/login');
        } catch (error) {
          console.error('Ошибка при выходе:', error);
          Alert.alert('Ошибка', 'Не удалось выйти из аккаунта');
        }
        break;

      case 'help':
        router.push('/help-support');
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.profileMenuContainer}>
          <View style={styles.profileMenu}>
            {/* Заголовок меню */}
            <TouchableOpacity
              style={styles.menuHeader}
              activeOpacity={0.8}
              onPress={() => handleMenuAction('profile')}
            >
              <View style={styles.userInfo}>
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#FFF" />
                </View>
                <View style={styles.userTextInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {isAuthenticated ? userName : 'Гость'}
                  </Text>
                  <Text style={styles.menuTitle}>
                    {isAuthenticated ? 'Профиль' : 'Войдите в аккаунт'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {isAuthenticated ? (
              // Меню для авторизованного пользователя
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuAction('settings')}
                >
                  <View style={styles.menuItemContent}>
                    <Ionicons name="settings-outline" size={22} color="#6A9AA9" style={styles.menuIcon} />
                    <Text style={styles.menuItemText}>Настройки профиля</Text>
                  </View>
                </TouchableOpacity>
                
                <View style={styles.menuDivider} />
                
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuAction('logout')}
                >
                  <View style={styles.menuItemContent}>
                    <Ionicons name="log-out-outline" size={22} color="#FF6B6B" style={styles.menuIcon} />
                    <Text style={[styles.menuItemText, styles.logoutText]}>Выйти из аккаунта</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              // Меню для гостя
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuAction('login')}
                >
                  <View style={styles.menuItemContent}>
                    <Ionicons name="log-in-outline" size={22} color="#6A9AA9" style={styles.menuIcon} />
                    <Text style={styles.menuItemText}>Войти</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleMenuAction('register')}
                >
                  <View style={styles.menuItemContent}>
                    <Ionicons name="person-add-outline" size={22} color="#6A9AA9" style={styles.menuIcon} />
                    <Text style={styles.menuItemText}>Регистрация</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleMenuAction('help')}
            >
              <View style={styles.menuItemContent}>
                <Ionicons name="help-circle-outline" size={22} color="#6A9AA9" style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Справка/Поддержка</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  profileMenuContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    alignItems: 'flex-end',
  },
  profileMenu: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    width: 250,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6A9AA9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userTextInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: '#212529',
    marginBottom: 2,
    fontFamily: "Playfair Display Regular",
    fontWeight: '600',
  },
  menuTitle: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: "Playfair Display Regular",
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 14,
    color: '#000',
    fontFamily: "Playfair Display Regular",
  },
  logoutText: {
    color: '#FF6B6B',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
});

export default ProfileMenu;