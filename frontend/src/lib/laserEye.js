import { easeCubicInOut, getEasedProgress } from "svelte-lib/functions"
import { configureCanvas2D, strokeOrFillCircle } from "svelte-lib/functions/canvas"

const laserEyeColor = "#cc0000"
const laserEyeDelayStep = 225
const laserEyeInitialDelay = 500
const laserEyeDuration = 3000
const laserEyeStartRadius = 0.25
const laserEyeStartStrokeWidth = 7.5
const laserEyePositions = [
  { xRatio: 0.44, yRatio: 0.5 },
  { xRatio: 0.6125, yRatio: 0.49 }
]

export const laserEyeRadiusScale = 0.75

export function createLaserEyeBurst({ displayHeight, displayWidth, now }) {
  return Array.from({ length: 4 }).flatMap((_, i) =>
    laserEyePositions.map(({ xRatio, yRatio }) => ({
      cx: displayWidth * xRatio,
      cy: displayHeight * yRatio,
      delay: i * laserEyeDelayStep + laserEyeInitialDelay,
      radiusBasis: displayWidth,
      start: now
    }))
  )
}

function getLaserEyeDraw(circle, timestamp) {
  let progress = getEasedProgress({
    delay: circle.delay,
    duration: laserEyeDuration,
    ease: easeCubicInOut,
    now: timestamp,
    start: circle.start
  })

  return {
    cx: circle.cx,
    cy: circle.cy,
    radius: laserEyeStartRadius + (circle.radiusBasis * laserEyeRadiusScale - laserEyeStartRadius) * progress,
    strokeOpacity: 1 - progress,
    strokeWidth: laserEyeStartStrokeWidth * (1 - progress)
  }
}

export function drawLaserEyeCanvas({ canvas, circles, height, overflow = 0, timestamp, width }) {
  let activeCircles = circles.filter(circle => timestamp - circle.start < circle.delay + laserEyeDuration)
  let { context } = configureCanvas2D({ canvas, height: height + overflow * 2, width: width + overflow * 2 })

  if (context) {
    context.clearRect(0, 0, width + overflow * 2, height + overflow * 2)
    context.save()
    context.translate(overflow, overflow)
    context.fillStyle = laserEyeColor
    context.strokeStyle = laserEyeColor

    activeCircles.forEach(circle => {
      let draw = getLaserEyeDraw(circle, timestamp)
      if (draw.strokeWidth <= 0 || draw.strokeOpacity <= 0) return

      context.globalAlpha = draw.strokeOpacity
      strokeOrFillCircle(context, { cx: draw.cx, cy: draw.cy, radius: draw.radius, strokeWidth: draw.strokeWidth })
    })

    context.globalAlpha = 1
    context.restore()
  }

  return { circles: activeCircles, hasActive: activeCircles.length > 0 }
}
