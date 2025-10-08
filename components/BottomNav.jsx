import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity 
} from "react-native";

export default function BottomNav() {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navButton}>
        <Text style={styles.navButtonText}>🏠</Text>
        <Text style={styles.navButtonLabel}>Главная</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton}>
        <Text style={styles.navButtonText}>📊</Text>
        <Text style={styles.navButtonLabel}>Статистика</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton}>
        <Text style={styles.navButtonText}>🍽️</Text>
        <Text style={styles.navButtonLabel}>Рецепты</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton}>
        <Text style={styles.navButtonText}>⚙️</Text>
        <Text style={styles.navButtonLabel}>Настройки</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E9ECEF",
    height: 70,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  navButtonText: {
    fontSize: 20,
    marginBottom: 4,

  },
  navButtonLabel: {
    fontSize: 12,
    color: "#000000ff",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
});