import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Image
} from "react-native";

export default function BottomNav() {
  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity style={styles.navButton}>
        <View style={styles.iconContainer}>
          {/* Замените source на ваши изображения */}
          <Image 
            source={require('@/assets/images/people-icon.png')} 
            style={styles.navIcon}
          />
        </View>

      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton}>
        <View style={styles.iconContainer}>
          <Image 
            source={require('@/assets/images/dishes-icon.png')} 
            style={styles.navIcon}
          />
        </View>

      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton}>
        <View style={styles.iconContainer}>
          <Image 
            source={require('@/assets/images/recipes-icon.png')} 
            style={styles.navIcon}
          />
        </View>

      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navButton}>
        <View style={styles.iconContainer}>
          <Image 
            source={require('@/assets/images/bookmarks-page-icon.png')} 
            style={styles.navIcon}
          />
        </View>

      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#C2DAE2", // Голубой фон как на картинке
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#fcfcfcff",
    height: 90,
  },
  navButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    backgroundColor: "#9BDF11", // Зеленый цвет кнопок
    marginHorizontal: 5,
    borderRadius: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  iconContainer: {
    width: 45,
    height: 45,
    justifyContent: "center",
    alignItems: "center",

  },
  navIcon: {
    width: 30,
    height: 30,
    resizeMode: "contain",
    tintColor: "#000", 
  },
  navButtonLabel: {
    fontSize: 12,
    color: "#000",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
});