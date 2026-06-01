import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useTheme } from "../context/ThemeContext";

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
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const wave = useRef(new Animated.Value(0)).current;
  const body = useRef(new Animated.Value(0)).current;
  const blade = useRef(new Animated.Value(0)).current;
  const mark = useRef(new Animated.Value(0)).current;
  const fullLogo = useRef(new Animated.Value(0)).current;
  const settle = useRef(new Animated.Value(0)).current;
  const didFinish = useRef(false);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(wave, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(body, { toValue: 1, duration: 760, delay: 150, easing: Easing.out(Easing.back(1.15)), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(blade, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(fullLogo, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(settle, { toValue: 1, duration: 860, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(mark, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => {
      if (didFinish.current) return;
      didFinish.current = true;
      onDone();
    });
  }, [blade, body, fullLogo, mark, onDone, settle, wave]);

  const compact = width < 390;
  const stageWidth = compact ? 214 : 286;
  const symbolSourceSize = stageWidth;
  const symbolHeight = stageWidth * 0.66;
  const wordmarkHeight = compact ? 66 : 82;
  const stageHeight = symbolHeight + wordmarkHeight + 14;
  const introScale = compact ? 2.05 : 2.2;
  const logoScale = settle.interpolate({ inputRange: [0, 1], outputRange: [introScale, 1] });
  const logoTranslateY = settle.interpolate({ inputRange: [0, 1], outputRange: [compact ? 54 : 74, 0] });
  const lineWidth = mark.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const assembledPartsOpacity = fullLogo.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 1, 0] });
  const logoTint = theme.text;

  return (
    <View style={[styles.slot, { height: stageHeight }]}>
      <Animated.View
        style={[
          styles.logoStage,
          {
            width: stageWidth,
            height: stageHeight,
            transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
          },
        ]}
      >
        <View style={[styles.symbolStage, { width: stageWidth, height: symbolHeight }]}>
          <Animated.View style={[styles.partsLayer, { opacity: assembledPartsOpacity }]}>
            <LogoPart
              clip={{ x: 0.03, y: 0.52, width: 0.56, height: 0.19 }}
              sourceSize={symbolSourceSize}
              tintColor={logoTint}
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
              tintColor={logoTint}
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
              tintColor={logoTint}
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
              tintColor={logoTint}
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
              tintColor={logoTint}
              animatedStyle={{
                opacity: body,
                transform: [{ scale: body.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
              }}
            />
            <LogoPart
              clip={{ x: 0.3, y: 0.24, width: 0.31, height: 0.12 }}
              sourceSize={symbolSourceSize}
              tintColor={logoTint}
              animatedStyle={{
                opacity: body,
                transform: [{ translateX: body.interpolate({ inputRange: [0, 1], outputRange: [-stageWidth * 0.2, 0] }) }],
              }}
            />
          </Animated.View>
          <Animated.Image
            source={symbolLogo}
            resizeMode="contain"
            style={[
              styles.fullSymbol,
              {
                width: stageWidth,
                height: symbolHeight,
                tintColor: logoTint,
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
              transform: [{ translateY: mark.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.wordmarkTop, { color: theme.text }, compact && styles.wordmarkTopCompact]}>
            MESSERS
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.wordmarkBottom, { color: theme.text }, compact && styles.wordmarkBottomCompact]}>
            CARDIO CLUB
          </Text>
          <View style={[styles.logoLineTrack, { backgroundColor: theme.border, width: stageWidth * 0.44 }]}>
            <Animated.View style={[styles.logoLineFill, { backgroundColor: theme.text, width: lineWidth }]} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function LogoPart({
  clip,
  sourceSize,
  tintColor,
  animatedStyle,
}: {
  clip: LogoClip;
  sourceSize: number;
  tintColor: string;
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
            tintColor,
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "visible",
    width: "100%",
  },
  logoStage: {
    alignItems: "center",
  },
  symbolStage: {
    overflow: "visible",
  },
  partsLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
    justifyContent: "flex-start",
    marginTop: -4,
  },
  wordmarkTop: {
    width: "100%",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 10,
    lineHeight: 18,
    textAlign: "center",
  },
  wordmarkTopCompact: {
    fontSize: 13,
    letterSpacing: 8,
    lineHeight: 16,
  },
  wordmarkBottom: {
    width: "100%",
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 3,
    lineHeight: 38,
    textAlign: "center",
  },
  wordmarkBottomCompact: {
    fontSize: 29,
    letterSpacing: 2,
    lineHeight: 33,
  },
  logoLineTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    marginTop: 4,
  },
  logoLineFill: {
    height: "100%",
    borderRadius: 999,
  },
});
