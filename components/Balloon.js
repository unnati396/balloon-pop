import React, { PureComponent } from 'react';
import { Animated, TouchableWithoutFeedback, Dimensions, View, StyleSheet, Text } from 'react-native';
import Svg, { Ellipse, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

const windowHeight = Dimensions.get('window').height;

export const BALLOON_COLORS = [
  { main: '#FF4757', highlight: '#FF6B81' },
  { main: '#1E90FF', highlight: '#70B8FF' },
  { main: '#2ED573', highlight: '#7BED9F' },
  { main: '#FFA502', highlight: '#FFBE56' },
  { main: '#A855F7', highlight: '#C084FC' },
  { main: '#FF6B9D', highlight: '#FFA3C4' },
  { main: '#00D2D3', highlight: '#55EFC4' },
  { main: '#FF9FF3', highlight: '#FCCFCF' },
];

let _svgIdCounter = 0;

const BalloonSvg = ({ color, size }) => {
  const gradId = React.useMemo(() => `grad-${_svgIdCounter++}`, []);
  const w = size;
  const h = size * 1.3;
  return (
    <Svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`}>
      <Defs>
        <RadialGradient id={gradId} cx="40%" cy="35%" rx="50%" ry="50%">
          <Stop offset="0%" stopColor={color.highlight} stopOpacity="1" />
          <Stop offset="100%" stopColor={color.main} stopOpacity="1" />
        </RadialGradient>
      </Defs>
      <Ellipse
        cx={w / 2} cy={h / 2}
        rx={w / 2 - 2} ry={h / 2 - 2}
        fill={`url(#${gradId})`}
      />
      <Path
        d={`M${w / 2 - 4},${h - 2} L${w / 2},${h + 6} L${w / 2 + 4},${h - 2}`}
        fill={color.main}
      />
      <Path
        d={`M${w / 2},${h + 6} Q${w / 2 + 6},${h + 13} ${w / 2 - 2},${h + 20}`}
        stroke="#888" strokeWidth="1" fill="none"
      />
      <Ellipse
        cx={w * 0.36} cy={h * 0.3}
        rx={w * 0.12} ry={h * 0.1}
        fill="white" opacity="0.4"
      />
    </Svg>
  );
};

// ─── Blast Effect ──────────────────────────────────────────

const NUM_SHARDS = 10;
const SHARD_SHAPES = ['square', 'wide', 'tall'];

class BlastEffect extends React.Component {
  constructor(props) {
    super(props);

    const cx = props.size / 2;
    const cy = (props.size * 1.3) / 2;

    this.ringAnim = new Animated.Value(0);
    this.flashAnim = new Animated.Value(1);
    this.popTextAnim = new Animated.Value(0);

    this.shards = Array.from({ length: NUM_SHARDS }, (_, i) => {
      const angle = (i / NUM_SHARDS) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
      const speed = 50 + Math.random() * 60;
      const shape = SHARD_SHAPES[Math.floor(Math.random() * SHARD_SHAPES.length)];
      const w = shape === 'wide' ? 14 : shape === 'tall' ? 6 : 9;
      const h = shape === 'wide' ? 6 : shape === 'tall' ? 14 : 9;

      return {
        anim: new Animated.Value(0),
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        gravity: 40 + Math.random() * 60,
        w,
        h,
        rotation: Math.random() * 360,
        spinTo: (Math.random() - 0.5) * 720,
        color: Math.random() > 0.4 ? props.color.main : props.color.highlight,
        cx,
        cy,
      };
    });

    this.state = { done: false };
  }

  componentDidMount() {
    Animated.parallel([
      Animated.timing(this.ringAnim, {
        toValue: 1, duration: 300, useNativeDriver: false,
      }),
      Animated.timing(this.flashAnim, {
        toValue: 0, duration: 120, useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(this.popTextAnim, {
          toValue: 1, duration: 150, useNativeDriver: false,
        }),
        Animated.timing(this.popTextAnim, {
          toValue: 0, duration: 300, useNativeDriver: false,
        }),
      ]),
      ...this.shards.map((s) =>
        Animated.timing(s.anim, {
          toValue: 1, duration: 450 + Math.random() * 200, useNativeDriver: false,
        })
      ),
    ]).start(() => {
      this.setState({ done: true });
    });
  }

  render() {
    if (this.state.done) return null;

    const size = this.props.size;
    const cx = size / 2;
    const cy = (size * 1.3) / 2;
    const area = size * 2.5;

    const ringScale = this.ringAnim.interpolate({
      inputRange: [0, 1], outputRange: [0.2, 2.5],
    });
    const ringOpacity = this.ringAnim.interpolate({
      inputRange: [0, 0.4, 1], outputRange: [0.9, 0.5, 0],
    });

    const popScale = this.popTextAnim.interpolate({
      inputRange: [0, 0.5, 1], outputRange: [0.5, 1.2, 1],
    });
    const popY = this.popTextAnim.interpolate({
      inputRange: [0, 1], outputRange: [cy, cy - 30],
    });

    return (
      <View
        style={[blastStyles.container, { width: area, height: area, left: -(area - size) / 2, top: -(area - size * 1.3) / 2 }]}
        pointerEvents="none"
      >
        {/* White flash */}
        <Animated.View
          style={[
            blastStyles.flash,
            {
              left: area / 2 - size * 0.4,
              top: area / 2 - size * 0.4,
              width: size * 0.8,
              height: size * 0.8,
              borderRadius: size * 0.4,
              opacity: this.flashAnim,
            },
          ]}
        />

        {/* Expanding shockwave ring */}
        <Animated.View
          style={[
            blastStyles.ring,
            {
              left: area / 2 - size * 0.5,
              top: area / 2 - size * 0.5,
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: this.props.color.highlight,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />

        {/* Rubber shards */}
        {this.shards.map((s, i) => {
          const tx = s.anim.interpolate({
            inputRange: [0, 1], outputRange: [area / 2, area / 2 + s.dx],
          });
          const ty = s.anim.interpolate({
            inputRange: [0, 0.4, 1],
            outputRange: [area / 2, area / 2 + s.dy * 0.6, area / 2 + s.dy + s.gravity],
          });
          const opacity = s.anim.interpolate({
            inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0],
          });
          const rotate = s.anim.interpolate({
            inputRange: [0, 1], outputRange: [`${s.rotation}deg`, `${s.rotation + s.spinTo}deg`],
          });
          const scale = s.anim.interpolate({
            inputRange: [0, 0.2, 1], outputRange: [1.2, 1, 0.4],
          });

          return (
            <Animated.View
              key={i}
              style={[
                blastStyles.shard,
                {
                  width: s.w,
                  height: s.h,
                  borderRadius: 2,
                  backgroundColor: s.color,
                  opacity,
                  transform: [
                    { translateX: tx },
                    { translateY: ty },
                    { rotate },
                    { scale },
                  ],
                },
              ]}
            />
          );
        })}

        {/* POP! text */}
        <Animated.Text
          style={[
            blastStyles.popText,
            {
              color: this.props.color.main,
              opacity: this.popTextAnim,
              transform: [
                { scale: popScale },
                { translateY: popY },
                { translateX: area / 2 - 18 },
              ],
            },
          ]}
        >
          POP!
        </Animated.Text>
      </View>
    );
  }
}

const blastStyles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  flash: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    backgroundColor: 'transparent',
  },
  shard: {
    position: 'absolute',
  },
  popText: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

// ─── Balloon Component ─────────────────────────────────────

export default class Balloon extends PureComponent {
  constructor(props) {
    super(props);

    this.balloonColor = BALLOON_COLORS[props.colorIndex % BALLOON_COLORS.length];

    this.state = {
      visible: true,
      bursting: false,
      gone: false,
    };

    this.scaleAnim = new Animated.Value(1);
    this.opacityAnim = new Animated.Value(1);

    this.moveAnimation = new Animated.ValueXY({
      x: props.x,
      y: windowHeight + 100 * Math.random(),
    });

    this.swayAnimation = new Animated.Value(0);

    Animated.sequence([
      Animated.timing(this.moveAnimation, {
        toValue: { x: props.x, y: -80 },
        duration: props.duration,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        this.props.onFinish(this.props.id);
        this.setState({ gone: true });
      }
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(this.swayAnimation, {
          toValue: 1,
          duration: 1200 + Math.random() * 800,
          useNativeDriver: false,
        }),
        Animated.timing(this.swayAnimation, {
          toValue: -1,
          duration: 1200 + Math.random() * 800,
          useNativeDriver: false,
        }),
      ])
    ).start();

    this.onClick = this.onClick.bind(this);
  }

  onClick() {
    if (this.state.bursting || this.state.gone) return;
    this.setState({ bursting: true });

    Animated.parallel([
      Animated.timing(this.scaleAnim, {
        toValue: 1.3, duration: 80, useNativeDriver: false,
      }),
      Animated.timing(this.opacityAnim, {
        toValue: 0, duration: 100, useNativeDriver: false,
      }),
    ]).start(() => {
      this.props.onBurst(this.props.id);
      Animated.timing(this.moveAnimation).stop();
      setTimeout(() => this.setState({ gone: true }), 600);
    });
  }

  render() {
    if (this.state.gone) return null;

    const swayOffset = this.swayAnimation.interpolate({
      inputRange: [-1, 1],
      outputRange: [-12, 12],
    });

    const layout = this.moveAnimation.getLayout();

    return (
      <View style={{ position: 'absolute' }}>
        <Animated.View
          style={[
            {
              width: this.props.balloonSize,
              height: this.props.balloonSize * 1.5,
              transform: [{ translateX: swayOffset }],
            },
            layout,
          ]}
        >
          {!this.state.bursting ? (
            <TouchableWithoutFeedback onPress={this.onClick}>
              <Animated.View
                style={{
                  transform: [{ scale: this.scaleAnim }],
                  opacity: this.opacityAnim,
                }}
              >
                <BalloonSvg
                  color={this.balloonColor}
                  size={this.props.balloonSize}
                />
              </Animated.View>
            </TouchableWithoutFeedback>
          ) : (
            <>
              <Animated.View
                style={{
                  transform: [{ scale: this.scaleAnim }],
                  opacity: this.opacityAnim,
                }}
              >
                <BalloonSvg
                  color={this.balloonColor}
                  size={this.props.balloonSize}
                />
              </Animated.View>

              <BlastEffect
                color={this.balloonColor}
                size={this.props.balloonSize}
              />
            </>
          )}
        </Animated.View>
      </View>
    );
  }
}

Balloon.defaultProps = {
  id: 1,
  x: 10,
  colorIndex: 0,
  onFinish: () => {},
  duration: 5000,
  onBurst: () => {},
  balloonSize: 50,
};
