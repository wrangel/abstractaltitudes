export default {
  multipass: false,
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          removeViewBox: false,
          convertPathData: {
            floatPrecision: 4,
            noSpaceAfterFlags: false,
            applyTransforms: false,
          },
          cleanupIDs: false,
          mergePaths: false,
          removeUselessStrokeAndFill: false,
        },
      },
    },
  ],
};

// Place the svg to optimize in the project root
// Run with pnpx svgo -c svgo.config.js C.svg -o D.svg
