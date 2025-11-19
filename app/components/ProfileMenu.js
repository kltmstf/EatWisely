// components/ProfileMenu.js
import React from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ProfileMenu = ({ visible, onClose, onMenuAction, userName = "Пользователь", userImage }) => {
  const router = useRouter();
  

  const handleMenuAction = (action) => {
  onMenuAction(action);
  
  switch (action) {
    case 'settings':
      console.log('Переход в настройки профиля');
      router.push('/profile-settings');
      break;
    case 'logout':
      console.log('Выход из аккаунта');
      // Переход на страницу приветствия
      router.push('/login');
      break;
    case 'help':
      console.log('Переход в справку/поддержку');
      router.push('/help-support');
      break;
  }
  onClose();
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
            {/* Заголовок меню с именем пользователя и аватаркой */}
            <View style={styles.menuHeader}>
              <View style={styles.userInfo}>
                <Image 
                  source={userImage || require('@/assets/images/people-icon.png')}
                  style={styles.userAvatar}
                />
                <View style={styles.userTextInfo}>
                  <Text style={styles.userName}>{userName}</Text>
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
                <Image 
                  source={require('@/assets/images/settings-icon.png')}
                  style={styles.menuIcon}
                />
                <Text style={styles.menuItemText}>Настройки профиля</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuAction('logout')}
            >
              <View style={styles.menuItemContent}>
                <Image 
                  source={require('@/assets/images/back-icon.png')}
                  style={[styles.menuIcon, styles.logoutIcon]}
                />
                <Text style={[styles.menuItemText, styles.logoutText]}>Выйти из аккаунта</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuAction('help')}
            >
              <View style={styles.menuItemContent}>
                <Image 
                  source={require('@/assets/images/support-icon.png')}
                  style={styles.menuIcon}
                />
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
    top: 10, // Отступ от верхнего края экрана
    right: 10, // Отступ от правого края экрана
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
    borderBottomColor: '#6A9AA9',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userTextInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    color: '#212529',
    marginBottom: 4,
    fontFamily: "Playfair Display Regular",
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '600',
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
    width: 24,
    height: 24,
    marginRight: 12,
    resizeMode: 'contain',
  },
  logoutIcon: {
    tintColor: '#DC3545',
  },
  menuItemText: {
    fontSize: 14,
    color: '#000000ff',
    fontFamily: "Playfair Display Regular",
    marginLeft: 0,
  },
  logoutText: {
    color: '#DC3545',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#6A9AA9',
    marginVertical: 4,
  },
});

export default ProfileMenu;