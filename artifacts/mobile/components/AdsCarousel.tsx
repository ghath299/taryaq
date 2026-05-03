import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Dimensions,
  ImageSourcePropType,
  ViewToken,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AccessibilityInfo,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useRouter } from "expo-router";
import { ThemedText } from "@/components/ThemedText";
import { Spacing } from "@/constants/colors";

export type AdSlide = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaRoute: string;
  image: ImageSourcePropType;
  gradient: [string, string, string];
  textColor?: string;
  ctaTextColor?: string;
};

const AUTO_SCROLL_INTERVAL = 4500;
const SCREEN_WIDTH = Dimensions.get("window").width;

type Props = {
  slides: AdSlide[];
  horizontalPadding?: number;
};

export function AdsCarousel({ slides, horizontalPadding = Spacing.xl }: Props) {
  const router = useRouter();
  const listRef = useRef<FlatList<AdSlide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(SCREEN_WIDTH);
  const [isPaused, setIsPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const slideWidth = containerWidth - horizontalPadding * 2;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isPaused || reduceMotion || slides.length <= 1) return;
    const timer = setInterval(() => {
      const next = (activeIndex + 1) % slides.length;
      listRef.current?.scrollToOffset({
        offset: next * slideWidth,
        animated: true,
      });
    }, AUTO_SCROLL_INTERVAL);
    return () => clearInterval(timer);
  }, [activeIndex, isPaused, reduceMotion, slides.length, slideWidth]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const handleScrollBegin = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offsetX / slideWidth);
      setActiveIndex(idx);
      setTimeout(() => setIsPaused(false), 2000);
    },
    [slideWidth],
  );

  const goToIndex = useCallback(
    (idx: number) => {
      listRef.current?.scrollToOffset({
        offset: idx * slideWidth,
        animated: true,
      });
      setIsPaused(true);
      setTimeout(() => setIsPaused(false), 3500);
    },
    [slideWidth],
  );

  const renderItem = ({ item }: { item: AdSlide }) => (
    <Pressable
      onPress={() => router.push(item.ctaRoute as never)}
      style={[styles.slide, { width: slideWidth }]}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
    >
      <LinearGradient
        colors={item.gradient}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 1, y: 0.8 }}
        style={styles.gradient}
      >
        <View style={styles.crossDecor1}>
          <Feather name="plus" size={22} color="rgba(255,255,255,0.25)" />
        </View>
        <View style={styles.crossDecor2}>
          <Feather name="plus" size={16} color="rgba(255,255,255,0.2)" />
        </View>
        <View style={styles.crossDecor3}>
          <Feather name="plus" size={28} color="rgba(255,255,255,0.18)" />
        </View>

        <View style={styles.imageCol}>
          <Image source={item.image} style={styles.image} contentFit="contain" priority="high" cachePolicy="memory-disk" />
        </View>
        <View style={styles.textCol}>
          <ThemedText
            type="h2"
            style={[styles.title, { color: item.textColor ?? "#FFF" }]}
          >
            {item.title}
          </ThemedText>
          <ThemedText
            type="small"
            style={[styles.subtitle, { color: (item.textColor ?? "#FFF") + "EE" }]}
          >
            {item.subtitle}
          </ThemedText>
          <View style={styles.cta}>
            <ThemedText
              type="small"
              style={[
                styles.ctaText,
                { color: item.ctaTextColor ?? item.gradient[0] },
              ]}
            >
              {item.ctaLabel}
            </ThemedText>
            <Feather
              name="chevron-left"
              size={14}
              color={item.ctaTextColor ?? item.gradient[0]}
            />
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );

  return (
    <View
      style={{ paddingHorizontal: horizontalPadding }}
      onLayout={(e) =>
        setContainerWidth(e.nativeEvent.layout.width + horizontalPadding * 2)
      }
    >
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollBeginDrag={handleScrollBegin}
        onMomentumScrollEnd={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
      />
      {slides.length > 1 ? (
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <Dot
              key={s.id}
              active={i === activeIndex}
              onPress={() => goToIndex(i)}
              accentColor={slides[activeIndex]?.gradient[0] ?? "#1F40C8"}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Dot({
  active,
  onPress,
  accentColor,
}: {
  active: boolean;
  onPress: () => void;
  accentColor: string;
}) {
  const w = useSharedValue(active ? 22 : 7);
  const o = useSharedValue(active ? 1 : 0.45);

  useEffect(() => {
    w.value = withTiming(active ? 22 : 7, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
    o.value = withTiming(active ? 1 : 0.45, { duration: 280 });
  }, [active, w, o]);

  const animStyle = useAnimatedStyle(() => ({
    width: w.value,
    opacity: o.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={active ? "الإعلان الحالي" : "انتقل إلى الإعلان"}
    >
      <Animated.View
        style={[
          styles.dot,
          animStyle,
          { backgroundColor: active ? accentColor : "#C8CDD6" },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slide: {
    paddingRight: 0,
  },
  gradient: {
    borderRadius: 22,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    flexDirection: "row-reverse",
    alignItems: "center",
    minHeight: 175,
    overflow: "hidden",
  },
  crossDecor1: { position: "absolute", top: 18, left: "32%" },
  crossDecor2: { position: "absolute", bottom: 22, left: "28%" },
  crossDecor3: { position: "absolute", top: "50%", left: "20%" },
  textCol: {
    flex: 1.2,
    alignItems: "flex-end",
    paddingRight: 4,
  },
  title: {
    fontWeight: "800",
    textAlign: "right",
    fontSize: 20,
    lineHeight: 28,
    marginBottom: 6,
  },
  subtitle: {
    textAlign: "right",
    marginBottom: 14,
    fontSize: 12,
  },
  cta: {
    backgroundColor: "#FFF",
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ctaText: {
    fontWeight: "700",
    fontSize: 13,
  },
  imageCol: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: 130,
    height: 150,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
});
