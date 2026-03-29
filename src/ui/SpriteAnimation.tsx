import { useEffect, useRef, useState } from "react";

interface SpriteAnimationProps {
  /** 스프라이트 시트 URL (가로 프레임 나열) */
  src: string;
  /** 총 프레임 수 */
  frameCount: number;
  /** 프레임 너비 (px) */
  frameWidth: number;
  /** 프레임 높이 (px) */
  frameHeight: number;
  /** 프레임당 시간 (ms), 기본 150 */
  frameDuration?: number;
  /** 반복 재생 여부, 기본 true */
  loop?: boolean;
  /** 특정 프레임에서 고정 (애니메이션 안함) */
  fixedFrame?: number;
  /** 표시 크기 (CSS) */
  width?: number | string;
  height?: number | string;
  /** 좌우반전 */
  flipX?: boolean;
  /** CSS className */
  className?: string;
  /** 재생 완료 콜백 (loop=false일 때) */
  onComplete?: () => void;
  /** 재생 여부, 기본 true */
  playing?: boolean;
}

export function SpriteAnimation({
  src,
  frameCount,
  frameWidth,
  frameHeight,
  frameDuration = 150,
  loop = true,
  fixedFrame,
  width,
  height,
  flipX = false,
  className = "",
  onComplete,
  playing = true,
}: SpriteAnimationProps) {
  const [currentFrame, setCurrentFrame] = useState(fixedFrame ?? 0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (fixedFrame !== undefined) {
      setCurrentFrame(fixedFrame);
      return;
    }

    if (!playing) return;

    timerRef.current = setInterval(() => {
      setCurrentFrame((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (loop) return 0;
          clearInterval(timerRef.current);
          onComplete?.();
          return prev;
        }
        return next;
      });
    }, frameDuration);

    return () => clearInterval(timerRef.current);
  }, [frameCount, frameDuration, loop, fixedFrame, playing, onComplete]);

  // 프레임 변경 시 고정 프레임 리셋
  useEffect(() => {
    if (fixedFrame !== undefined) {
      setCurrentFrame(fixedFrame);
    }
  }, [fixedFrame]);

  const displayW = width ?? frameWidth;
  const displayH = height ?? frameHeight;

  // 프레임 위치: 현재 프레임 / (총 프레임 - 1) * 100%
  // background-size: (총 프레임 수 * 100)% → 각 프레임이 컨테이너와 동일 크기
  // background-position-x: 0% = 첫 프레임, 100% = 마지막 프레임
  const posX = frameCount > 1 ? (currentFrame / (frameCount - 1)) * 100 : 0;

  return (
    <div
      className={className}
      style={{
        width: typeof displayW === "number" ? `${displayW}px` : displayW,
        height: typeof displayH === "number" ? `${displayH}px` : displayH,
        transform: flipX ? "scaleX(-1)" : undefined,
        backgroundImage: `url(${src})`,
        backgroundSize: `${frameCount * 100}% 100%`,
        backgroundPositionX: `${posX}%`,
        backgroundPositionY: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** 단일 이미지 표시 (스프라이트 아님) */
export function GameImage({
  src,
  width,
  height,
  flipX = false,
  className = "",
  style,
}: {
  src: string;
  width?: number | string;
  height?: number | string;
  flipX?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <img
      src={src}
      className={className}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        transform: flipX ? "scaleX(-1)" : undefined,
        objectFit: "contain",
        imageRendering: "auto",
        ...style,
      }}
      alt=""
      draggable={false}
    />
  );
}
