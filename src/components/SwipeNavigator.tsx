import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, PanResponder, useWindowDimensions, View } from "react-native";

const MAIN_ROUTES = ["/", "/chat", "/members", "/menu"] as const;
const SWIPE_THRESHOLD = 70;

export function SwipeNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const currentIndex = MAIN_ROUTES.findIndex((route) => route === pathname);
  const tx = useRef(new Animated.Value(0)).current;
  const enterFrom = useRef(0);
  const navigating = useRef(false);

  // Slide the new screen in from the swipe direction after navigation.
  useEffect(() => {
    navigating.current = false;
    if (enterFrom.current !== 0) {
      tx.setValue(enterFrom.current * width);
      Animated.spring(tx, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 200, mass: 0.7 }).start();
      enterFrom.current = 0;
    } else {
      tx.setValue(0);
    }
  }, [pathname, tx, width]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !navigating.current && currentIndex >= 0 && Math.abs(gesture.dx) > 16 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
        onPanResponderMove: (_, gesture) => {
          if (navigating.current || currentIndex < 0) return;
          const nextIndex = gesture.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const hasNext = Boolean(MAIN_ROUTES[nextIndex]);
          tx.setValue(hasNext ? gesture.dx : gesture.dx * 0.22);
        },
        onPanResponderRelease: (_, gesture) => {
          if (currentIndex < 0) {
            Animated.spring(tx, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
            return;
          }
          const goNext = gesture.dx < 0;
          const nextRoute = MAIN_ROUTES[goNext ? currentIndex + 1 : currentIndex - 1];
          if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD && nextRoute) {
            navigating.current = true;
            enterFrom.current = goNext ? 1 : -1;
            Animated.timing(tx, { toValue: goNext ? -width : width, duration: 170, useNativeDriver: true }).start(() => {
              router.push(nextRoute);
            });
          } else {
            Animated.spring(tx, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, damping: 24, stiffness: 220 }).start();
        },
      }),
    [currentIndex, tx, width],
  );

  return (
    <View style={{ flex: 1, overflow: "hidden" }} {...panResponder.panHandlers}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: tx }] }}>{children}</Animated.View>
    </View>
  );
}
