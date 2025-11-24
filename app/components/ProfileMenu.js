import React from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
// 1. Импортируем контекст и иконки
import { useAuthContext } from '@/app/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const ProfileMenu = ({ visible, onClose, userName = "Пользователь" }) => {
  const router = useRouter();
  // 2. Достаем функцию выхода из контекста
  const { signOut } = useAuthContext();

  const handleMenuAction = async (action) => {
    // Сначала закрываем меню
    onClose();

    switch (action) {
      case 'settings':
        console.log('Переход в настройки профиля');
        // router.push('/profile-settings');
        // Если такой страницы еще нет, можно закомментировать
        break;

      case 'logout':
        try {
          // 3. Реальный выход из системы
          await signOut();
          console.log('Выход из аккаунта выполнен');
          // 4. replace вместо push, чтобы очистить историю навигации
          router.replace('/login');
        } catch (error) {
          console.error('Ошибка при выходе:', error);
          Alert.alert('Ошибка', 'Не удалось выйти из аккаунта');
        }
        break;

      case 'help':
        console.log('Переход в справку/поддержку');
        // router.push('/help-support');
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
            <View style={styles.menuHeader}>
              <View style={styles.userInfo}>
                {/* Иконка пользователя вместо картинки */}
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#FFF" />
                </View>
                <View style={styles.userTextInfo}>
                  <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
                  <Text style={styles.menuTitle}>Профиль</Text>
                </View>
              </View>
            </View>
            {/* Пункты меню */}
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
                <Ionicons name="log-out-outline" size={22} color="#DC3545" style={styles.menuIcon} />
                <Text style={[styles.menuItemText, styles.logoutText]}>Выйти из аккаунта</Text>
              </View>
            </TouchableOpacity>

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
    top: 50, // Чуть ниже, чтобы не наезжало на статус бар
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
    color: '#DC3545',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 2,
  },
});

export default ProfileMenu;