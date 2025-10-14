// components/ProfileMenu.js
import React from 'react';
import {
  Modal,
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Image
} from 'react-native';

// Импортируем иконки (замените на реальные пути к вашим иконкам)
const BackIcon = require('@/assets/images/back-icon.png'); // Замените на реальный путь
const SettingIcon = require('@/assets/images/settings-icon.png'); // Замените на реальный путь
const SupportIcon = require('@/assets/images/support-icon.png'); // Замените на реальный путь

const ProfileMenu = ({ visible, onClose, onMenuAction, userName = "Пользователь", userImage }) => {
  const handleMenuAction = (action) => {
    onMenuAction(action);
    if (action === 'logout') {
      // Здесь должна быть логика перехода на страницу приветствия
      // Например: navigation.navigate('Welcome')
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
                  source={userImage || require('@/assets/images/people-icon.png')} // Замените на путь к дефолтной аватарке
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
                <Image source={SettingIcon} style={styles.menuIcon} />
                <Text style={styles.menuItemText}>Настройки профиля</Text>
              </View>
            </TouchableOpacity>
            
            <View style={styles.menuDivider} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuAction('logout')}
            >
              <View style={styles.menuItemContent}>
                <Image source={BackIcon} style={styles.menuIcon} />
                <Text style={[styles.menuItemText, styles.logoutText]}>Выйти из аккаунта</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleMenuAction('help')}
            >
              <View style={styles.menuItemContent}>
                <Image source={SupportIcon} style={styles.menuIcon} />
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
    justifyContent: 'flex-start',
  },
  profileMenuContainer: {
    marginTop: 50, // Отступ от верха экрана
    alignItems: 'flex-end',
    paddingRight: 20,
    flex: 1,
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
    borderBottomColor: '#E9ECEF',
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
    fontSize: 14,
    color: '#6C757D',
    marginBottom: 4,
    fontFamily: "Playfair Display Regular",
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
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
    width: 20,
    height: 20,
    marginRight: 12,
    tintColor: '#000000ff', // Можно настроить цвет иконок
  },
  menuItemText: {
    fontSize: 14,
    color: '#212529',
    fontFamily: "Playfair Display Regular",
  },
  logoutText: {
    color: '#DC3545',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 4,
  },
});

export default ProfileMenu;