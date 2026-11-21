/**
 * The picture is AUTHORED at 60fps: every frame number in the composition is a
 * 60fps frame. Rendering at a lower fps is handled by scaling the clock, not by
 * re-authoring the timings — that keeps one source of truth and makes 30fps a
 * pure speed switch (half the frames, identical motion in seconds).
 */
export const AUTHORED_FPS = 60;
export const AUTHORED_DURATION = 1380;
