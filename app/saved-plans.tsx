// app/(tabs)/profile/saved-plans.tsx
import { Ionicons, Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState, useMemo } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, TextInput } from "react-native";

// --- ТИПЫ ДАННЫХ ---
type Plan = {
    id: number;
    name: string;
    description: string;
    totalCalories: number;
    duration: string;
    mealsCount: number;
    image: any;
    savedDate: string;
    category: string;
};

// --- ДАННЫЕ ---
const savedPlans: Plan[] = [
    {
        id: 1,
        name: "План для похудения",
        description: "Сбалансированное питание на неделю",
        totalCalories: 1500,
        duration: "7 дней",
        mealsCount: 21,
        image: require("@/assets/images/breakfast-oats.png"),
        savedDate: "12.12.2023",
        category: "Похудение"
    },
    {
        id: 2,
        name: "Энергичное утро",
        description: "Завтраки для продуктивного дня",
        totalCalories: 1800,
        duration: "5 дней",
        mealsCount: 5,
        image: require("@/assets/images/lunch-soup.png"),
        savedDate: "10.12.2023",
        category: "Энергия"
    },
    {
        id: 3,
        name: "Здоровый рацион",
        description: "Полноценное питание на каждый день",
        totalCalories: 2200,
        duration: "30 дней",
        mealsCount: 90,
        image: require("@/assets/images/dinner-rice.png"),
        savedDate: "05.12.2023",
        category: "Здоровье"
    },
    {
        id: 4,
        name: "Спортивное питание",
        description: "Для активных тренировок",
        totalCalories: 2800,
        duration: "14 дней",
        mealsCount: 42,
        image: require("@/assets/images/snack-fruits.png"),
        savedDate: "01.12.2023",
        category: "Спорт"
    },
];

const categories = ["Все", "Похудение", "Энергия", "Здоровье", "Спорт"];

export default function SavedPlansScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Все");

    // Фильтрация планов
    const filteredPlans = useMemo(() => {
        return savedPlans.filter((plan) => {
            const matchesSearch = plan.name
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
                plan.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory =
                selectedCategory === "Все" || plan.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    const navigateToPlan = (plan: Plan) => {
        console.log(`Переход к плану: ${plan.name}`);
        // Здесь должна быть навигация на страницу плана
    };

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedCategory("Все");
    };

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerTitle: "Сохраненные планы",
                    headerBackTitle: "Назад",
                }}
            />
            
            {/* Заголовок с кнопкой назад */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Сохраненные планы</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                {/* Поиск и фильтры */}
                <View style={styles.searchSection}>
                    {/* Поле поиска */}
                    <View style={styles.searchRow}>
                        <View style={styles.searchInputContainer}>
                            <Feather
                                name="search"
                                size={16}
                                color="#666"
                                style={styles.searchIcon}
                            />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Поиск планов..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                    </View>

                    {/* Фильтры по категориям */}
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoriesContainer}
                    >
                        {categories.map((category) => (
                            <TouchableOpacity
                                key={category}
                                style={[
                                    styles.categoryButton,
                                    selectedCategory === category && styles.categoryButtonActive
                                ]}
                                onPress={() => setSelectedCategory(category)}
                            >
                                <Text style={[
                                    styles.categoryText,
                                    selectedCategory === category && styles.categoryTextActive
                                ]}>
                                    {category}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>                 

                    <View style={styles.sectionDivider} />
                </View>

                {/* Контент */}
                <View style={styles.plansSection}>
                    {filteredPlans.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="calendar-outline" size={64} color="#C2DAE2" />
                            <Text style={styles.emptyTitle}>Планы не найдены</Text>
                            <Text style={styles.emptyText}>
                                {searchQuery || selectedCategory !== "Все"
                                    ? "Попробуйте изменить параметры поиска"
                                    : "Сохраняйте понравившиеся планы питания для быстрого доступа"}
                            </Text>
                            {(searchQuery || selectedCategory !== "Все") && (
                                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
                                    <Text style={styles.clearFiltersText}>Показать все планы</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        <>
                            <Text style={styles.plansTitle}>
                                {filteredPlans.length} планов найдено
                            </Text>

                            <View style={styles.plansList}>
                                {filteredPlans.map((plan) => (
                                    <TouchableOpacity key={plan.id} style={styles.planCard} onPress={() => navigateToPlan(plan)}>
                                        <Image source={plan.image} style={styles.planImage} resizeMode="cover" />
                                        <View style={styles.planContent}>
                                            <View style={styles.planHeader}>
                                                <Text style={styles.planName}>{plan.name}</Text>
                                                <View style={[styles.planCategoryBadge, { backgroundColor: getCategoryColor(plan.category) }]}>
                                                    <Text style={styles.planCategoryText}>{plan.category}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.planDescription}>{plan.description}</Text>
                                            <View style={styles.planDetails}>
                                                <View style={styles.planDetail}>
                                                    <Ionicons name="flame-outline" size={14} color="#FF6B6B" />
                                                    <Text style={styles.planDetailText}>{plan.totalCalories} ккал/день</Text>
                                                </View>
                                                <View style={styles.planDetail}>
                                                    <Ionicons name="time-outline" size={14} color="#6A9AA9" />
                                                    <Text style={styles.planDetailText}>{plan.duration}</Text>
                                                </View>
                                                <View style={styles.planDetail}>
                                                    <Ionicons name="restaurant-outline" size={14} color="#9BDF11" />
                                                    <Text style={styles.planDetailText}>{plan.mealsCount} приёмов</Text>
                                                </View>
                                            </View>
                                            <View style={styles.planFooter}>
                                                <Text style={styles.planDate}>Сохранено: {plan.savedDate}</Text>
                                                <TouchableOpacity style={styles.usePlanButton}>
                                                    <Text style={styles.usePlanButtonText}>Использовать</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

// Вспомогательная функция для цвета категории
const getCategoryColor = (category: string) => {
    switch (category) {
        case "Похудение": return "#FF6B6B";
        case "Энергия": return "#FFD93D";
        case "Здоровье": return "#6BCF7F";
        case "Спорт": return "#4D96FF";
        default: return "#6A9AA9";
    }
};

// --- СТИЛИ ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    // Заголовок с кнопкой назад
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 15,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 2,
        borderBottomColor: "#6A9AA9",
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 24,
        color: "#1a1a1a",
        fontFamily: "Playfair Display Bold",
        textAlign: "center",
    },
    scrollContainer: {
        flex: 1,
    },
    // Секция поиска и фильтров
    searchSection: {
        backgroundColor: "#FFFFFF",
        padding: 15,
        marginBottom: 1,
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        marginBottom: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FFFFFF",
        borderRadius: 30,
        borderWidth: 2,
        borderColor: "#6A9AA9",
        paddingHorizontal: 15,
        paddingVertical: 6,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: "#000",
        paddingVertical: 4,
        fontFamily: "Playfair Display Regular",
    },
    categoriesContainer: {
        marginBottom: 12,
    },
    categoryButton: {
        backgroundColor: "white",
        borderWidth: 2,
        borderColor: "#6A9AA9",
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
    },
    categoryButtonActive: {
        backgroundColor: "#9BDF11",
        borderColor: "#9BDF11",
    },
    categoryText: {
        fontSize: 14,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
        fontWeight: "600",
    },
    categoryTextActive: {
        color: "#000000",
    },
    clearButton: {
        alignSelf: 'flex-start',
        backgroundColor: "#FF6B6B",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        marginBottom: 8,
    },
    clearButtonText: {
        color: "#FFFFFF",
        fontSize: 12,
        fontWeight: "600",
        fontFamily: "Playfair Display Regular",
    },
    sectionDivider: {
        height: 2,
        backgroundColor: "#6A9AA9",
        marginHorizontal: -15,
        marginTop: 12,
    },
    // Секция планов
    plansSection: {
        backgroundColor: "#FFFFFF",
        padding: 15,
        paddingBottom: 20,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        color: '#6C757D',
        fontFamily: 'Playfair Display Regular',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6C757D',
        fontFamily: 'Playfair Display Regular',
        textAlign: 'center',
        marginBottom: 20,
    },
    clearFiltersButton: {
        backgroundColor: "#9BDF11",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
    },
    clearFiltersText: {
        color: "#000000",
        fontSize: 16,
        fontWeight: "600",
        fontFamily: "Playfair Display Regular",
    },
    plansTitle: {
        fontSize: 16,
        color: "#000000ff",
        marginBottom: 16,
        fontWeight: "500",
        fontFamily: "Playfair Display Regular",
    },
    plansList: {
        gap: 16,
    },
    planCard: {
        backgroundColor: "#C2DAE2",
        borderRadius: 16,
        overflow: "hidden",
        flexDirection: "row",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
        height: 140,
    },
    planImage: {
        width: 120,
        height: "100%",
    },
    planContent: {
        flex: 1,
        padding: 12,
        justifyContent: "space-between",
    },
    planHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 4,
    },
    planName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#212529",
        fontFamily: "Playfair Display Regular",
        flex: 1,
        marginRight: 8,
    },
    planCategoryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    planCategoryText: {
        fontSize: 10,
        fontWeight: "bold",
        color: "#FFFFFF",
        fontFamily: "Playfair Display Regular",
    },
    planDescription: {
        fontSize: 12,
        color: "#6A9AA9",
        fontFamily: "Playfair Display Regular",
        marginBottom: 8,
    },
    planDetails: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
        flexWrap: 'wrap',
    },
    planDetail: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    planDetailText: {
        fontSize: 10,
        color: "#000000",
        fontFamily: "Playfair Display Regular",
    },
    planFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
    },
    planDate: {
        fontSize: 10,
        color: "#6C757D",
        fontFamily: "Playfair Display Regular",
    },
    usePlanButton: {
        backgroundColor: "#9BDF11",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
    },
    usePlanButtonText: {
        color: "#000000",
        fontSize: 12,
        fontWeight: "600",
        fontFamily: "Playfair Display Regular",
    },
});