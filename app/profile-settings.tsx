// app/profile-settings.tsx
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    TextInput,
    Image
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

type UserData = {
    name: string;
    email: string;
    description: string;
    age: string;
    height: string;
    gender: string;
    weight: string;
    goal: string;
    activity: string;
    nutritionType: string;
    allergies: string;
    dislikes: string;
    isPrivate: boolean;
};

export default function ProfileSettings() {
    const router = useRouter();
    
    const [userData, setUserData] = useState<UserData>({
        name: "",
        email: "",
        description: "",
        age: "-",
        height: "-",
        gender: "Муж",
        weight: "-",
        goal: "Поддержание веса",
        activity: "Низкий (0-1 тренировка в неделю)",
        nutritionType: "Обычное",
        allergies: "орехи, цитрусы",
        dislikes: "грибы, брокколи",
        isPrivate: false
    });

    const goals = [
        "Похудение",
        "Поддержание веса", 
        "Набор веса"
    ];

    const activityLevels = [
        "Низкий (0-1 тренировка в неделю)",
        "Умеренный (2-3 тренировки в неделю)",
        "Интенсивный (3 и более тренировки в неделю)"
    ];

    const nutritionTypes = [
        "Обычное",
        "Вегетарианское",
        "Веганское"
    ];

    const genders = [
        "Муж",
        "Жен"
    ];

    // Ключ для хранения данных профиля
    const PROFILE_STORAGE_KEY = 'user_profile_data';

    // Загрузка данных при монтировании
    useEffect(() => {
        loadProfileData();
    }, []);

    // Функция загрузки данных
    const loadProfileData = async () => {
        try {
            const savedData = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
            if (savedData !== null) {
                const parsedData = JSON.parse(savedData);
                setUserData(parsedData);
            }
        } catch (error) {
            console.log('Ошибка при загрузке данных профиля:', error);
        }
    };

    // Функция сохранения данных
    const saveProfileData = async (data: UserData) => {
        try {
            await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
            console.log('Данные профиля сохранены');
        } catch (error) {
            console.log('Ошибка при сохранении данных профиля:', error);
        }
    };

    // Автосохранение при изменении данных
    useEffect(() => {
        if (userData.name || userData.email) { // Сохраняем только если есть какие-то данные
            saveProfileData(userData);
        }
    }, [userData]);

    const handleBack = () => {
        router.back();
    };

    const handleSave = () => {
        saveProfileData(userData);
        console.log("Сохранение данных:", userData);
        router.back();
    };

    // Функция для смены фото профиля (заглушка)
    const handleChangePhoto = () => {
        console.log("Смена фото профиля");
        // Здесь будет логика выбора фото из галереи или камеры
        alert('Функция смены фото будет реализована позже');
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" />
            
            {/* Шапка с кнопкой назад и заголовком */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                    <Image 
                        source={require('@/assets/images/back-icon.png')}
                        style={styles.backIcon}
                    />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>Настройки профиля</Text>
                </View>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Основная информация с фото профиля */}
                <View style={styles.section}>
                    <View style={styles.profileHeader}>
                        <View style={styles.photoContainer}>
                            <Image 
                                source={require('@/assets/images/people-icon.png')}
                                style={styles.profilePhoto}
                            />
                            <TouchableOpacity 
                                style={styles.editPhotoButton}
                                onPress={handleChangePhoto}
                            >
                                <Image 
                                    source={require('@/assets/images/edit-icon.png')}
                                    style={styles.editIcon}
                                />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.sectionTitleSmall}>Имя пользователя</Text>
                            <TextInput
                                style={styles.inputSmall}
                                value={userData.name}
                                onChangeText={(text) => setUserData({...userData, name: text})}
                                placeholder="Введите имя"
                            />
                            
                            <Text style={styles.sectionTitleSmall}>Email</Text>
                            <TextInput
                                style={styles.inputSmall}
                                value={userData.email}
                                onChangeText={(text) => setUserData({...userData, email: text})}
                                placeholder="Введите email"
                                keyboardType="email-address"
                            />
                        </View>
                    </View>
                    
                    <Text style={[styles.sectionTitle, styles.descriptionTitle]}>Описание</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        value={userData.description}
                        onChangeText={(text) => setUserData({...userData, description: text})}
                        placeholder="Расскажите о себе"
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Ваши данные */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ваши данные</Text>
                    
                    <View style={styles.dataGrid}>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Возраст:</Text>
                            <TextInput
                                style={styles.dataInput}
                                value={userData.age}
                                onChangeText={(text) => setUserData({...userData, age: text})}
                                placeholder="-"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Рост:</Text>
                            <TextInput
                                style={styles.dataInput}
                                value={userData.height}
                                onChangeText={(text) => setUserData({...userData, height: text})}
                                placeholder="-"
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Пол:</Text>
                            <View style={styles.genderContainer}>
                                {genders.map((gender) => (
                                    <TouchableOpacity
                                        key={gender}
                                        style={[
                                            styles.genderButton,
                                            userData.gender === gender && styles.genderButtonActive
                                        ]}
                                        onPress={() => setUserData({...userData, gender})}
                                    >
                                        <Text style={[
                                            styles.genderText,
                                            userData.gender === gender && styles.genderTextActive
                                        ]}>
                                            {gender}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Вес:</Text>
                            <TextInput
                                style={styles.dataInput}
                                value={userData.weight}
                                onChangeText={(text) => setUserData({...userData, weight: text})}
                                placeholder="-"
                                keyboardType="numeric"
                            />
                        </View>
                    </View>
                </View>

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Цель */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ваша цель:</Text>
                    <View style={styles.optionsContainer}>
                        {goals.map((goal) => (
                            <TouchableOpacity
                                key={goal}
                                style={[
                                    styles.optionButton,
                                    userData.goal === goal && styles.optionButtonActive
                                ]}
                                onPress={() => setUserData({...userData, goal})}
                            >
                                <Text style={[
                                    styles.optionText,
                                    userData.goal === goal && styles.optionTextActive
                                ]}>
                                    {goal}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Уровень активности */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ваш уровень активности:</Text>
                    <View style={styles.optionsContainer}>
                        {activityLevels.map((activity) => (
                            <TouchableOpacity
                                key={activity}
                                style={[
                                    styles.optionButton,
                                    userData.activity === activity && styles.optionButtonActive
                                ]}
                                onPress={() => setUserData({...userData, activity})}
                            >
                                <Text style={[
                                    styles.optionText,
                                    userData.activity === activity && styles.optionTextActive
                                ]}>
                                    {activity}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Тип питания */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Тип питания:</Text>
                    <View style={styles.optionsContainer}>
                        {nutritionTypes.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.optionButton,
                                    userData.nutritionType === type && styles.optionButtonActive
                                ]}
                                onPress={() => setUserData({...userData, nutritionType: type})}
                            >
                                <Text style={[
                                    styles.optionText,
                                    userData.nutritionType === type && styles.optionTextActive
                                ]}>
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Аллергии и исключения */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Аллергии и исключения</Text>
                    
                    <View style={styles.allergySection}>
                        <Text style={styles.allergyLabel}>Аллергия на:</Text>
                        <TextInput
                            style={styles.allergyInput}
                            value={userData.allergies}
                            onChangeText={(text) => setUserData({...userData, allergies: text})}
                            placeholder="орехи, цитрусы"
                        />
                    </View>
                    
                    <View style={styles.dividerThin} />
                    
                    <View style={styles.allergySection}>
                        <Text style={styles.allergyLabel}>Не любит:</Text>
                        <TextInput
                            style={styles.allergyInput}
                            value={userData.dislikes}
                            onChangeText={(text) => setUserData({...userData, dislikes: text})}
                            placeholder="грибы, брокколи"
                        />
                    </View>
                </View>

                {/* Разделитель */}
                <View style={styles.divider} />

                {/* Приватность профиля */}
                <View style={styles.section}>
                    <View style={styles.privacyContainer}>
                        <Text style={styles.privacyText}>Сделать профиль приватным:</Text>
                        <TouchableOpacity 
                            style={[
                                styles.switch,
                                userData.isPrivate && styles.switchActive
                            ]}
                            onPress={() => setUserData({...userData, isPrivate: !userData.isPrivate})}
                        >
                            <View style={[
                                styles.switchThumb,
                                userData.isPrivate && styles.switchThumbActive
                            ]} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Отступ для фиксированной кнопки */}
                <View style={styles.bottomSpacing} />
            </ScrollView>

            {/* Фиксированная кнопка сохранения */}
            <TouchableOpacity 
                style={styles.floatingSaveButton}
                onPress={handleSave}
            >
                <Image 
                    source={require('@/assets/images/checkmark-done.png')}
                    style={styles.saveIcon}
                />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "white",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 15,
        backgroundColor: "#C2DAE2",
    },
    backButton: {
        padding: 10,
    },
    backIcon: {
        width: 30,
        height: 15,
        tintColor: "#000000",
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: "center",
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000000",
        fontFamily: "Playfair Display Regular",
        textAlign: "center",
        maxWidth: "80%",
    },
    placeholder: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    // Стили для фото профиля
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    photoContainer: {
        position: 'relative',
        marginRight: 16,
    },
    profilePhoto: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    editPhotoButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editIcon: {
        width: 25,
        height: 25,
    },
    profileInfo: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#000000",
        marginBottom: 12,
        fontFamily: "Playfair Display Regular",
    },
    sectionTitleSmall: {
        fontSize: 16,
        fontWeight: "600",
        color: "#000000",
        marginBottom: 8,
        fontFamily: "Playfair Display Regular",
    },
    descriptionTitle: {
        marginTop: 0,
    },
    input: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9", // Голубая обводка
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: "#000000",
        marginBottom: 16,
        fontFamily: "Playfair Display Regular",
    },
    inputSmall: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9", // Голубая обводка
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        color: "#000000",
        marginBottom: 10,
        fontFamily: "Playfair Display Regular",
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    divider: {
        height: 2,
        backgroundColor: "#C2DAE2",
        marginHorizontal: 10,
    },
    dividerThin: {
        height: 1,
        backgroundColor: "#C2DAE2",
        marginVertical: 12,
    },
    dataGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dataItem: {
        width: '48%',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    dataLabel: {
        fontSize: 16,
        color: "#000000",
        marginBottom: 8,
        fontWeight: "500",
        fontFamily: "Playfair Display Regular",
    },
    dataInput: {
        width: '100%',
        fontSize: 16,
        color: "#000000",
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9", // Голубая обводка
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontFamily: "Playfair Display Regular",
    },
    // Стили для выбора пола
    genderContainer: {
        flexDirection: 'row',
        gap: 8,
        width: '100%',
    },
    genderButton: {
        flex: 1,
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9", // Голубая обводка
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: 'center',
    },
    genderButtonActive: {
        backgroundColor: "#9BDF11",
        borderColor: "#9BDF11",
    },
    genderText: {
        fontSize: 14,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    genderTextActive: {
        color: "#000000",
    },
    optionsContainer: {
        gap: 8,
    },
    optionButton: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9", // Голубая обводка
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    optionButtonActive: {
        backgroundColor: "#9BDF11",
        borderColor: "#9BDF11",
    },
    optionText: {
        fontSize: 14,
        color: "#000000",
        textAlign: 'center',
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    optionTextActive: {
        color: "#000000",
    },
    allergySection: {
        marginBottom: 12,
    },
    allergyLabel: {
        fontSize: 16,
        color: "#000000",
        marginBottom: 8,
        fontWeight: "500",
        fontFamily: "Playfair Display Regular",
    },
    allergyInput: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9", // Голубая обводка
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
    },
    privacyContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    privacyText: {
        fontSize: 16,
        color: "#000000",
        fontWeight: "500",
        fontFamily: "Playfair Display Regular",
    },
    switch: {
        width: 50,
        height: 28,
        backgroundColor: "#C2DAE2",
        borderRadius: 14,
        padding: 2,
    },
    switchActive: {
        backgroundColor: "#9BDF11",
    },
    switchThumb: {
        width: 24,
        height: 24,
        backgroundColor: "white",
        borderRadius: 12,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
        elevation: 2,
    },
    switchThumbActive: {
        transform: [{ translateX: 22 }],
    },
    bottomSpacing: {
        height: 80,
    },
    // Фиксированная кнопка сохранения
    floatingSaveButton: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#9BDF11',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    saveIcon: {
        width: 24,
        height: 24,
        tintColor: "#000000",
    },
});