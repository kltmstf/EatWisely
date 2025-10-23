// app/profile-settings.tsx
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
        gender: "-",
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

    const handleBack = () => {
        router.back();
    };

    const handleSave = () => {
        console.log("Сохранение данных:", userData);
        router.back();
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
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Сохранить</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Основная информация */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Имя пользователя</Text>
                    <TextInput
                        style={styles.input}
                        value={userData.name}
                        onChangeText={(text) => setUserData({...userData, name: text})}
                        placeholder="Введите имя"
                    />
                    
                    <Text style={styles.sectionTitle}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={userData.email}
                        onChangeText={(text) => setUserData({...userData, email: text})}
                        placeholder="Введите email"
                        keyboardType="email-address"
                    />
                    
                    <Text style={styles.sectionTitle}>Описание</Text>
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
                            />
                        </View>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Рост:</Text>
                            <TextInput
                                style={styles.dataInput}
                                value={userData.height}
                                onChangeText={(text) => setUserData({...userData, height: text})}
                                placeholder="-"
                            />
                        </View>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Пол:</Text>
                            <TextInput
                                style={styles.dataInput}
                                value={userData.gender}
                                onChangeText={(text) => setUserData({...userData, gender: text})}
                                placeholder="-"
                            />
                        </View>
                        <View style={styles.dataItem}>
                            <Text style={styles.dataLabel}>Вес:</Text>
                            <TextInput
                                style={styles.dataInput}
                                value={userData.weight}
                                onChangeText={(text) => setUserData({...userData, weight: text})}
                                placeholder="-"
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

                {/* Отступ внизу */}
                <View style={styles.bottomSpacing} />
            </ScrollView>
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
        backgroundColor: "#6A9AA9",
    },
    backButton: {
        padding: 8,
    },
    backIcon: {
        width: 24,
        height: 24,
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
    saveButton: {
        padding: 8,
    },
    saveButtonText: {
        fontSize: 16,
        color: "#000000",
        fontWeight: "600",
        fontFamily: "Playfair Display Regular",
    },
    scrollView: {
        flex: 1,
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "600",
        color: "#000000",
        marginBottom: 12,
        fontFamily: "Playfair Display Regular",
    },
    input: {
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#E9ECEF",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        color: "#000000",
        marginBottom: 16,
        fontFamily: "Playfair Display Regular",
    },
    textArea: {
        height: 80,
        textAlignVertical: 'top',
    },
    divider: {
        height: 1,
        backgroundColor: "#E9ECEF",
        marginHorizontal: 20,
    },
    dividerThin: {
        height: 1,
        backgroundColor: "#E9ECEF",
        marginVertical: 12,
    },
    dataGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    dataItem: {
        width: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dataLabel: {
        fontSize: 16,
        color: "#000000",
        marginRight: 8,
        fontWeight: "500",
        minWidth: 50,
        fontFamily: "Playfair Display Regular",
    },
    dataInput: {
        flex: 1,
        fontSize: 16,
        color: "#000000",
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#E9ECEF",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontFamily: "Playfair Display Regular",
    },
    optionsContainer: {
        gap: 8,
    },
    optionButton: {
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "#E9ECEF",
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    optionButtonActive: {
        backgroundColor: "#6A9AA9",
        borderColor: "#6A9AA9",
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
        borderWidth: 1,
        borderColor: "#E9ECEF",
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
        height: 20,
    },
});