// app/(tabs)/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

function CustomTabBarIcon({ focused, iconName, label }: { 
  focused: boolean; 
  iconName: string; 
  label: string; 
}) {
  return (
    <View style={[
      styles.tabButton,
      focused && styles.activeTabButton
    ]}>
      <Ionicons 
        name={iconName as any} 
        size={28} 
        color={focused ? '#000' : '#000'} 
      />
      <Text style={[
        styles.tabLabel,
        focused && styles.activeTabLabel
      ]}>
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen 
        name="community" 
        options={{
          tabBarIcon: ({ focused }) => (
            <CustomTabBarIcon 
              focused={focused}
              iconName={focused ? 'people' : 'people-outline'}
              label="Сообщество"
            />
          ),
        }}
      />
      <Tabs.Screen 
        name="home" 
        options={{
          tabBarIcon: ({ focused }) => (
            <CustomTabBarIcon 
              focused={focused}
              iconName={focused ? 'home' : 'home-outline'}
              label="Главная"
            />
          ),
        }}
      />
      <Tabs.Screen 
        name="recipes" 
        options={{
          tabBarIcon: ({ focused }) => (
            <CustomTabBarIcon 
              focused={focused}
              iconName={focused ? 'book' : 'book-outline'}
              label="Рецепты"
            />
          ),
        }}
      />
      <Tabs.Screen 
        name="favorites" 
        options={{
          tabBarIcon: ({ focused }) => (
            <CustomTabBarIcon 
              focused={focused}
              iconName={focused ? 'bookmark' : 'bookmark-outline'}
              label="Избранное"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#C2DAE2',
    borderTopWidth: 2,
    borderTopColor: '#6A9AA9',
    
    height: 120,
    // Убираем отступы безопасной зоны
    paddingBottom: 45,
    marginBottom: 0,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9BDF11',
    borderRadius: 12,
    shadowColor: "#000",
    borderColor: '#C2DAE2',
    height: 60,
    width: 90,
    borderWidth: 2,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    // Поднимаем кнопки выше
    marginTop: -10,
  },
  activeTabButton: {
    backgroundColor: '#7BBF01', 
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
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#000',
    textAlign: 'center',
    fontFamily: 'Playfair Display Regular',
  },
  activeTabLabel: {
    fontWeight: '600',
    color: '#000',
    fontFamily: 'Playfair Display Bold',
  },
});