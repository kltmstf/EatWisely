import React from "react";
import { Text, View, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";

export default function Title() {
    const router = useRouter();
  return (
    <View style={styles.container}>
      {/* Первый контейнер: логотип, заголовок, линия и подзаголовок */}
      <View style={styles.topContainer}>
        <View style={styles.headerContent}>
          <Image
            source={require("@/assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          
          <View style={styles.textContent}>
            <Text style={styles.titleText}>EatWisely</Text>
            <View style={styles.divider} />
            <Text style={styles.subtitleText}>
              Ваш персональный гид по питанию!
            </Text>
          </View>
        </View>
      </View>
      
      {/* Второй контейнер: описание по центру */}
      <View style={styles.middleContainer}>
        <Text style={styles.descriptionText}>
          Создавайте рационы всего за пару минут.
        </Text>
      </View>
      
      {/* Третий контейнер: кнопка снизу */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => router.push('/welcome')}
        >
          <Text style={styles.buttonText}>Начать!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#C2DAE2"
  },

  topContainer: {
    flex: 0.4, 
    justifyContent: "flex-start",
    paddingTop: 150, 
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    width: "100%",
  },
  logo: {
    width: 150,
    height: 150,
    marginRight: 10,

  },
  textContent: {
    flex: 1,
    justifyContent: "flex-start",
  },
  titleText: {
    color: 'black',
    fontFamily: 'Playfair Display Bold', 
    fontSize: 40,
    fontWeight: 'normal', 
    textAlign: 'center',
    marginBottom: 5,
  },
  subtitleText: {
    color: 'black',
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 5,
    width: "100%"
  },
  divider: {
    width: "100%",
    height: 3,
    backgroundColor: "#000",
    borderRadius: 3,
  },

  middleContainer: {
    flex: 0.3, 
    justifyContent: "center",
    alignItems: "center",
  },
  descriptionText: {
    color: 'black',
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 20,
    width: "80%",
  },

  bottomContainer: {
    flex: 0.3, 
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 150,
  },
  button: {
    backgroundColor: '#9BDF11',
    borderRadius: 75,
    paddingVertical: 15,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',

    borderWidth: 2,
    borderColor: '#C2DAE2', 
    

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    

    elevation: 8,
  },
  buttonText: {
    color: 'black',
    fontFamily: 'Playfair Display Regular',
    fontSize: 18,
    fontWeight: 'normal',
  }
});