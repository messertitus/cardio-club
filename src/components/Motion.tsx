import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type MotionPressableProps = PressableProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
};

export function MotionPressable({ children, style, pressedStyle, onPressIn, onPressOut, ...props }: MotionPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        Animated.spring(scale, { toValue: 0.975, damping: 18, stiffness: 220, useNativeDriver: true }).start();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        Animated.spring(scale, { toValue: 1, damping: 18, stiffness: 220, useNativeDriver: true }).start();
        onPressOut?.(event);
      }}
    >
      {({ pressed }) => <Animated.View style={[style, { transform: [{ scale }] }, pressed && pressedStyle]}>{children}</Animated.View>}
    </Pressable>
  );
}

export function Reveal({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 360, delay: 60 * index, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: 60 * index, damping: 18, stiffness: 130, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}
