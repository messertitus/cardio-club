import { router, usePathname } from "expo-router";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Easing, PanResponder, useWindowDimensions, View } from "react-native";

const MAIN_ROUTES = ["/", "/chat", "/members", "/menu"] as const;
const SWIPE_THRESHOLD = 64;

export function SwipeNavigator({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const currentIndex = MAIN_ROUTES.findIndex((route) => route === pathname);
  const tx = useRef(new Animated.Value(0)).current;
  const enterFrom = useRef(0);
  const navigating = useRef(false);

  // Slide + fade the new screen in from the swipe direction after navigation.
  useEffect(() => {
    navigating.current = false;
    if (enterFrom.current !== 0) {
      tx.setValue(enterFrom.current * width);
      Animated.timing(tx, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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
          // Rubber-band resistance when there is no screen in that direction.
          tx.setValue(hasNext ? gesture.dx : gesture.dx * 0.22);
        },
        onPanResponderRelease: (_, gesture) => {
          if (currentIndex < 0) {
            settleBack(tx);
            return;
          }
          const goNext = gesture.dx < 0;
          const nextRoute = MAIN_ROUTES[goNext ? currentIndex + 1 : currentIndex - 1];
          const committed = Math.abs(gesture.dx) >= SWIPE_THRESHOLD || Math.abs(gesture.vx) > 0.35;
          if (committed && nextRoute) {
            navigating.current = true;
            enterFrom.current = goNext ? 1 : -1;
            Animated.timing(tx, {
              toValue: goNext ? -width : width,
              duration: 190,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) router.push(nextRoute);
            });
          } else {
            settleBack(tx);
          }
        },
        onPanResponderTerminate: () => settleBack(tx),
      }),
    [currentIndex, tx, width],
  );

  // Gentle dim toward the edges so the screen swap underneath is masked.
  const opacity = tx.interpolate({ inputRange: [-width, 0, width], outputRange: [0.5, 1, 0.5], extrapolate: "clamp" });

  return (
    <View style={{ flex: 1, overflow: "hidden" }} {...panResponder.panHandlers}>
      <Animated.View style={{ flex: 1, opacity, transform: [{ translateX: tx }] }}>{children}</Animated.View>
    </View>
  );
}

function settleBack(tx: Animated.Value) {
  Animated.spring(tx, { toValue: 0, useNativeDriver: true, damping: 26, stiffness: 240, mass: 0.7 }).start();
}
