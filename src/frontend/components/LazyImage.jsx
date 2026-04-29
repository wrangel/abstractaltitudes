// src/frontend/components/LazyImage.jsx

import { useEffect, useRef, useState } from "react";

// 1. Add onLoad and onError to the destructured props
const LazyImage = ({
  src,
  alt,
  className,
  style,
  width,
  height,
  onLoad,
  onError,
}) => {
  const imgRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries, observerInstance) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observerInstance.disconnect();
            }
          });
        },
        { rootMargin: "100px" },
      );

      observer.observe(imgRef.current);
      return () => observer.disconnect();
    } else {
      setIsVisible(true);
    }
  }, []);

  return (
    <img
      ref={imgRef}
      src={isVisible ? src : undefined}
      alt={alt}
      className={className}
      // 2. Attach the listeners here
      onLoad={onLoad}
      onError={onError}
      style={{
        ...style,
        width,
        height,
        aspectRatio: width && height ? `${width} / ${height}` : undefined,
      }}
      loading="lazy"
      width={width}
      height={height}
    />
  );
};

export default LazyImage;
