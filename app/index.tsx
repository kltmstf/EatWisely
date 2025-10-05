import React from "react";
import { StyleSheet, View } from "react-native";
import Title from "./title"; // Импортируем компонент Title

export default function Index() {
  return (
    <View style={styles.container}>
      <Title /> {/* Отображаем компонент Title */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#C2DAE2",
  },
});