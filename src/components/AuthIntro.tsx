import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const symbolLogo = require("../../assets/mcc-logo-white-symbol-transparent.png");

type AuthIntroProps = {
  onDone: () => void;
};

type LogoClip = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function AuthIntro({ onDone }: AuthIntroProps) {
  const { width, height } = useWindowDimensions();
  const wave = useRef(new Animated.Value(0)).current;
  const body = useRef(new Animated.Value(0)).current;
  const blade = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const fullLogo = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(wave, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(body, { toValue: 1, duration: 760, delay: 150, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(blade, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(mark, { toValue: 1, duration: 780, delay: 160, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
      Animated.timing(fullLogo, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(settle, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ]).start(() => onDone());
  }, [blade, body, fullLogo, mark, onDone, settle, wave]);

  const compact = width < 390;
  const stageWidth = Math.min(width * 0.9, 430);
  const symbolSourceSize = stageWidth;
  const symbolHeight = stageWidth;
  const wordmarkHeight = stageWidth * 0.22;
  const stageHeight = symbolHeight + wordmarkHeight + 12;
  const endWidth = compact ? 220 : 258;
  const startTop = height * 0.2;
  const endTop = compact ? 40 : Math.max(34, height * 0.055);
  const logoScale = settle.interpolate({ inputRange: [0, 1], outputRange: [1.04, endWidth / stageWidth] });
  const logoTranslateY = settle.interpolate({ inputRange: [0, 1], outputRange: [0, endTop - startTop] });
  const overlayOpacity = settle.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 1, 0] });
  const lineWidth = mark.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity: overlayOpacity }]}>
      <Animated.View
        style={[
          styles.logoStage,
          {
            width: stageWidth,
            height: stageHeight,
            top: startTop,
            marginLeft: -stageWidth / 2,
            transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
          },
        ]}
      >
        <View style={[styles.symbolStage, { width: stageWidth, height: symbolHeight }]}>
          <LogoPart
            clip={{ x: 0.03, y: 0.52, width: 0.56, height: 0.19 }}
            sourceSize={symbolSourceSize}
            animatedStyle={{
              opacity: wave,
              transform: [
                { translateX: wave.interpolate({ inputRange: [0, 1], outputRange: [-stageWidth * 0.42, 0] }) },
                { translateY: wave.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
              ],
            }}
          />
          <LogoPart
            clip={{ x: 0.3, y: 0.23, width: 0.39, height: 0.37 }}
            sourceSize={symbolSourceSize}
            animatedStyle={{
              opacity: body,
              transform: [
                { translateX: body.interpolate({ inputRange: [0, 1], outputRange: [-stageWidth * 0.34, 0] }) },
                { translateY: body.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                { rotate: body.interpolate({ inputRange: [0, 1], outputRange: ["-7deg", "0deg"] }) },
              ],
            }}
          />
          <LogoPart
            clip={{ x: 0.48, y: 0.16, width: 0.46, height: 0.19 }}
            sourceSize={symbolSourceSize}
            animatedStyle={{
              opacity: blade,
              transform: [
                { translateX: blade.interpolate({ inputRange: [0, 1], outputRange: [stageWidth * 0.46, 0] }) },
                { translateY: blade.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
                { rotate: blade.interpolate({ inputRange: [0, 1], outputRange: ["7deg", "0deg"] }) },
              ],
            }}
          />
          <LogoPart
            clip={{ x: 0.64, y: 0.36, width: 0.28, height: 0.27 }}
            sourceSize={symbolSourceSize}
            animatedStyle={{
              opacity: blade,
              transform: [
                { scale: blade.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
                { rotate: blade.interpolate({ inputRange: [0, 1], outputRange: ["18deg", "0deg"] }) },
              ],
            }}
          />
          <LogoPart
            clip={{ x: 0.54, y: 0.12, width: 0.14, height: 0.13 }}
            sourceSize={symbolSourceSize}
            animatedStyle={{
              opacity: body,
              transform: [{ scale: body.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
            }}
          />
          <LogoPart
            clip={{ x: 0.3, y: 0.24, width: 0.31, height: 0.12 }}
            sourceSize={symbolSourceSize}
            animatedStyle={{
              opacity: body,
              transform: [{ translateX: body.interpolate({ inputRange: [0, 1], outputRange: [-stageWidth * 0.2, 0] }) }],
            }}
          />
          <Animated.Image
            source={symbolLogo}
            resizeMode="contain"
            style={[
              styles.fullSymbol,
              {
                width: stageWidth,
                height: symbolHeight,
                opacity: fullLogo,
                transform: [{ scale: fullLogo.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) }],
              },
            ]}
          />
        </View>

        <Animated.View
          style={[
            styles.wordmark,
            {
              width: stageWidth,
              height: wordmarkHeight,
              opacity: mark,
              transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          <Text style={styles.wordmarkTop}>MESSERS</Text>
          <Text style={styles.wordmarkBottom}>CARDIO CLUB</Text>
        </Animated.View>
        <View style={[styles.logoLineTrack, { width: stageWidth * 0.15 }]}>
          <Animated.View style={[styles.logoLineFill, { width: lineWidth }]} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function LogoPart({
  clip,
  sourceSize,
  animatedStyle,
}: {
  clip: LogoClip;
  sourceSize: number;
  animatedStyle: object;
}) {
  return (
    <Animated.View
      style={[
        styles.partClip,
        {
          left: sourceSize * clip.x,
          top: sourceSize * clip.y,
          width: sourceSize * clip.width,
          height: sourceSize * clip.height,
        },
        animatedStyle,
      ]}
    >
      <Image
        source={symbolLogo}
        resizeMode="stretch"
        style={[
          styles.partImage,
          {
            left: -sourceSize * clip.x,
            top: -sourceSize * clip.y,
            width: sourceSize,
            height: sourceSize,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    backgroundColor: "#05070b",
    zIndex: 30,
    overflow: "hidden",
  },
  logoStage: {
    position: "absolute",
    left: "50%",
    alignItems: "center",
  },
  symbolStage: {
    overflow: "visible",
  },
  fullSymbol: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  partClip: {
    position: "absolute",
    overflow: "hidden",
  },
  partImage: {
    position: "absolute",
  },
  wordmark: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -6,
  },
  wordmarkTop: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 11,
    lineHeight: 20,
    textAlign: "center",
  },
  wordmarkBottom: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 4,
    lineHeight: 39,
    textAlign: "center",
  },
  logoLineTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    marginTop: -13,
  },
  logoLineFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#ffffff",
  },
});
