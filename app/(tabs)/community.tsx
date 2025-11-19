import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import ProfileMenu from "../components/ProfileMenu";

export default function Community() {
  const router = useRouter();
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("Все");

  const filters = ["Все", "Рецепты", "Вопросы", "Отзывы", "Советы"];

  const communityPosts = [
    {
      id: 1,
      userName: "Анна Петрова",
      userAvatar: require('@/assets/images/people-icon.png'),
      postType: "Рецепты",
      title: "Полезный завтрак на неделю",
      content: "Поделюсь своими любимыми рецептами полезных завтраков, которые готовлю каждое утро! 🍓🥣",
      image: require('@/assets/images/breakfast-oats.png'),
      likes: 24,
      comments: 8,
      timeAgo: "2 часа назад",
      verified: true
    },
    {
      id: 2,
      userName: "Максим Иванов",
      userAvatar: require('@/assets/images/people-icon.png'),
      postType: "Вопросы",
      title: "Как разнообразить рацион?",
      content: "Ребята, подскажите идеи для разнообразия питания. Надоело есть одно и то же каждый день...",
      image: null,
      likes: 15,
      comments: 12,
      timeAgo: "5 часов назад",
      verified: false
    },
    {
      id: 3,
      userName: "Елена Сидорова",
      userAvatar: require('@/assets/images/people-icon.png'),
      postType: "Отзывы",
      title: "Результат за 3 месяца",
      content: "С помощью EatWisely похудела на 8 кг! Спасибо за отличные рецепты и поддержку сообщества! 💪",
      image: require('@/assets/images/snack-fruits.png'),
      likes: 42,
      comments: 15,
      timeAgo: "1 день назад",
      verified: true
    },
    {
      id: 4,
      userName: "Дмитрий Козлов",
      userAvatar: require('@/assets/images/people-icon.png'),
      postType: "Советы",
      title: "Лайфхаки для кухни",
      content: "Делюсь своими кухонными лайфхаками, которые экономят время и делают готовку приятнее!",
      image: null,
      likes: 31,
      comments: 7,
      timeAgo: "2 дня назад",
      verified: false
    },
    {
      id: 5,
      userName: "Ольга Новикова",
      userAvatar: require('@/assets/images/people-icon.png'),
      postType: "Рецепты",
      title: "Веганский ужин за 20 минут",
      content: "Быстрый и вкусный веганский ужин, который полюбила вся семья! Рецепт в комментариях 👇",
      image: require('@/assets/images/dinner-rice.png'),
      likes: 28,
      comments: 11,
      timeAgo: "3 дня назад",
      verified: true
    },
    {
      id: 6,
      userName: "Сергей Васильев",
      userAvatar: require('@/assets/images/people-icon.png'),
      postType: "Вопросы",
      title: "Спортивное питание",
      content: "Кто занимается спортом? Какие блюда из EatWisely лучше всего подходят для набора массы?",
      image: null,
      likes: 19,
      comments: 23,
      timeAgo: "3 дня назад",
      verified: false
    }
  ];

  const userData = {
    name: "Пользователь"
  };

  const filteredPosts = communityPosts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = selectedFilter === "Все" || post.postType === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const handleProfileMenu = () => {
    setProfileMenuVisible(!profileMenuVisible);
  };

  const handleMenuAction = (action: string) => {
    console.log(`Выбрано действие: ${action}`);
    switch (action) {
      case 'settings':
        console.log('Переход в настройки профиля');
        break;
      case 'logout':
        console.log('Выход из аккаунта');
        break;
      case 'help':
        console.log('Переход в справку/поддержку');
        break;
    }
  };

  const navigateToPost = (post: any) => {
    console.log(`Переход к посту: ${post.title}`);
    // Здесь можно добавить навигацию на страницу поста
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedFilter("Все");
  };

  return (
    <ImageBackground 
      source={require('@/assets/images/background.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        {/* Верхнее меню с приветствием */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.greetingText}>
              Сообщество, {userData.name}!
            </Text>
            <Text style={styles.dietText}>
              Общайтесь, делитесь опытом и находите друзей
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={handleProfileMenu}
          >
            <Image 
              source={require('@/assets/images/people-icon.png')}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>

        {/* Компонент меню профиля */}
        <ProfileMenu
          visible={profileMenuVisible}
          onClose={() => setProfileMenuVisible(false)}
          onMenuAction={handleMenuAction}
          userName={userData.name}
          userImage={require('@/assets/images/people-icon.png')}
        />

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Поиск и фильтры */}
          <View style={styles.searchSection}>
            {/* Заголовок фильтров */}
            <View style={styles.filtersHeader}>
              <Text style={styles.filtersTitle}>Типы постов</Text>
              {(searchQuery || selectedFilter !== "Все") && (
                <TouchableOpacity 
                  style={styles.clearButton}
                  onPress={clearFilters}
                >
                  <Text style={styles.clearButtonText}>Сбросить</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Фильтры */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.filtersContainer}
              contentContainerStyle={styles.filtersContent}
            >
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterButton,
                    selectedFilter === filter && styles.filterButtonActive
                  ]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <Text style={[
                    styles.filterText,
                    selectedFilter === filter && styles.filterTextActive
                  ]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Поле поиска */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Поиск в сообществе..."
                  placeholderTextColor="#666"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            <View style={styles.sectionDivider} />
          </View>

          {/* Посты сообщества */}
          <View style={styles.postsSection}>
            <Text style={styles.postsTitle}>
              {filteredPosts.length} постов найдено
            </Text>

            {/* Список постов */}
            <View style={styles.postsList}>
              {filteredPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  {/* Заголовок поста и пользователь */}
                  <View style={styles.postHeader}>
                    <View style={styles.userInfo}>
                      <Image 
                        source={post.userAvatar}
                        style={styles.userAvatar}
                      />
                      <View style={styles.userDetails}>
                        <View style={styles.userNameContainer}>
                          <Text style={styles.userName}>{post.userName}</Text>
                          {post.verified && (
                            <Image 
                              source={require('@/assets/images/checkmark-done.png')}
                              style={styles.verifiedIcon}
                            />
                          )}
                        </View>
                        <Text style={styles.postTime}>{post.timeAgo}</Text>
                      </View>
                    </View>
                    <View style={[
                      styles.postTypeBadge,
                      { backgroundColor: getPostTypeColor(post.postType) }
                    ]}>
                      <Text style={styles.postTypeText}>{post.postType}</Text>
                    </View>
                  </View>

                  {/* Контент поста */}
                  <TouchableOpacity 
                    style={styles.postContent}
                    onPress={() => navigateToPost(post)}
                  >
                    <Text style={styles.postTitle}>{post.title}</Text>
                    <Text style={styles.postText}>{post.content}</Text>
                    
                    {post.image && (
                      <Image 
                        source={post.image}
                        style={styles.postImage}
                        resizeMode="cover"
                      />
                    )}
                  </TouchableOpacity>

                  {/* Действия с постом */}
                  <View style={styles.postActions}>
                    <TouchableOpacity style={styles.actionButton}>
                      <Image 
                        source={require('@/assets/images/thumbs-up-icon.png')}
                        style={styles.actionIcon}
                      />
                      <Text style={styles.actionText}>{post.likes}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionButton}>
                      <Image 
                        source={require('@/assets/images/email-icon.png')}
                        style={styles.actionIcon}
                      />
                      <Text style={styles.actionText}>{post.comments}</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.actionButton}>
                      <Image 
                        source={require('@/assets/images/back-icon.png')}
                        style={styles.actionIcon}
                      />
                      <Text style={styles.actionText}>Поделиться</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

      </View>
    </ImageBackground>
  );
}

// Функция для цветов типов постов
const getPostTypeColor = (postType: string) => {
  switch (postType) {
    case "Рецепты":
      return "#9BDF11";
    case "Вопросы":
      return "#6A9AA9";
    case "Отзывы":
      return "#FFA726";
    case "Советы":
      return "#7E57C2";
    default:
      return "#C2DAE2";
  }
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderBottomWidth: 2,
    borderBottomColor: "#6A9AA9",
  },
  headerTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: "normal",
    color: "#000000ff",
    marginBottom: 4,
    fontFamily: "Playfair Display Bold",
  },
  dietText: {
    fontSize: 16,
    color: "#6C757D",
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  profileButton: {
    width: 55,
    height: 55,
    borderRadius: 20,
    overflow: "hidden",
    marginLeft: 16,
  },
  profileImage: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
  },
  scrollView: {
    flex: 1,
  },
  searchSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    marginBottom: 1,
  },
  filtersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Playfair Display Regular',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Playfair Display Regular',
  },
  filtersContainer: {
    marginBottom: 16,
    maxHeight: 40,
  },
  filtersContent: {
    paddingRight: 10,
  },
  filterButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#6A9AA9",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: "#9BDF11",
    borderColor: "#9BDF11",
  },
  filterText: {
    fontSize: 14,
    color: "#000000",
    fontFamily: "Playfair Display Regular",
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#000000",
  },
  searchContainer: {
    marginBottom: 0,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffffff',
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#6A9AA9',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 8,
    fontFamily: 'Playfair Display Regular',
  },
  sectionDivider: {
    height: 2,
    backgroundColor: "#6A9AA9",
    marginHorizontal: -20,
    marginTop: 16,
  },
  postsSection: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    padding: 20,
    paddingBottom: 20,
  },
  postsTitle: {
    fontSize: 16,
    color: "#000000ff",
    marginBottom: 16,
    fontWeight: "500",
    fontFamily: "Playfair Display Regular",
  },
  postsList: {
    gap: 16,
  },
  postCard: {
    backgroundColor: "#C2DAE2",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#A8C8D4",
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Playfair Display Regular',
    marginRight: 6,
  },
  verifiedIcon: {
    width: 16,
    height: 16,
  },
  postTime: {
    fontSize: 12,
    color: '#6C757D',
    fontFamily: 'Playfair Display Regular',
    marginTop: 2,
  },
  postTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 8,
  },
  postTypeText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
    fontFamily: 'Playfair Display Regular',
  },
  postContent: {
    marginBottom: 12,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Playfair Display Bold',
    marginBottom: 8,
  },
  postText: {
    fontSize: 14,
    color: '#333333',
    fontFamily: 'Playfair Display Regular',
    lineHeight: 20,
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#A8C8D4',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionIcon: {
    width: 18,
    height: 18,
    marginRight: 6,
    tintColor: '#6A9AA9',
  },
  actionText: {
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Playfair Display Regular',
  },
});