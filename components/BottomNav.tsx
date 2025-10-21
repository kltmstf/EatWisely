// components/BottomNav.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet } from 'react-native';

const BottomNav = () => {
  const [activeTab, setActiveTab] = useState('home');

  const tabs = [

    { id: 'recipes', icon: require('@/assets/images/dishes-icon.png'), label: 'Рацион' },
        { id: 'home', icon: require('@/assets/images/people-icon.png'), label: 'Сообщество' },
    { id: 'favorites', icon: require('@/assets/images/recipes-icon.png'), label: 'Рецепты' },
    { id: 'profile', icon: require('@/assets/images/bookmarks-page-icon.png'), label: 'Избранные' },
  ];

  const handleTabPress = (tabId: string) => {
    setActiveTab(tabId);
    // Здесь будет навигация по табам
    console.log(`Переход на вкладку: ${tabId}`);
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[
            styles.tabButton,
            activeTab === tab.id && styles.activeTabButton
          ]}
          onPress={() => handleTabPress(tab.id)}
        >
          <Image
            source={tab.icon}
            style={[
              styles.tabIcon,
              activeTab === tab.id && styles.activeTabIcon
            ]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: '#6A9AA9',
    height: 90,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: '#9BDF11',
    marginHorizontal: 5,
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    borderColor: '#C2DAE2',
    height: 60,
    borderWidth: 2,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  activeTabButton: {
    backgroundColor: '#7BBF01', // Более темный зеленый для активной кнопки
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
    borderColor: '#6A9AA9',
    borderWidth: 2,
  },
  tabIcon: {
    width: 25,
    height: 25,
    resizeMode: "contain",
    tintColor: "#000",
  },
  activeTabIcon: {
    tintColor: "#000",
  },
});

export default BottomNav;