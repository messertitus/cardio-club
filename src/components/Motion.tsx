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

export function Reveal({ children, index = 0, delay, style }: { children: ReactNode; index?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current;
  const startDelay = delay ?? 60 * index;

  useEffect(() => {
    // useNativeDriver:false — rotateX uses a "deg" string which the native
    // driver cannot interpolate on react-native-web (animation would not run).
    Animated.spring(progress, { toValue: 1, delay: startDelay, damping: 17, stiffness: 130, useNativeDriver: false }).start();
  }, [progress, startDelay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.965, 1] });
  const rotateX = progress.interpolate({ inputRange: [0, 1], outputRange: ["7deg", "0deg"] });

  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ perspective: 700 }, { translateY }, { rotateX }, { scale }] }]}>
      {children}
    </Animated.View>
  );
}
