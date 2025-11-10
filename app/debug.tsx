import React from 'react';
import { View, Text } from 'react-native';

export default function Debug() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Debug Page - Only Text in Text components</Text>
    </View>
  );
}