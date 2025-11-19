// components/Layout.js
import React from 'react';
import { SafeAreaView, View } from 'react-native-safe-area-context';

export const Layout = ({ 
  children, 
  style, 
  scrollable = true,
  scrollableComponent: ScrollableComponent 
}) => {
  // Если не нужен скролл или передан кастомный скроллящийся компонент
  if (!scrollable || ScrollableComponent) {
    return (
      <SafeAreaView style={[{ flex: 1 }, style]}>
        {ScrollableComponent ? ScrollableComponent : children}
      </SafeAreaView>
    );
  }

  // Для обычного случая - просто SafeAreaView
  return (
    <SafeAreaView style={[{ flex: 1 }, style]}>
      {children}
    </SafeAreaView>
  );
};

// Дополнительный компонент для скроллящейся области
export const ScrollableContent = ({ children, style }) => {
  return (
    <View style={[{ flex: 1 }, style]}>
      {children}
    </View>
  );
};