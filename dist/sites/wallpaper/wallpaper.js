// ============ CONSTANTS ============
const STORAGE_KEY = 'wallpaperSettings';
const BACKEND_URL = "http://localhost:3001";
const WS_URL = "ws://localhost:3002";
const HOST_MODE = new URLSearchParams(window.location.search).get('hostMode') || 'standard';
const SAFE_MODE = HOST_MODE === 'safe';

let ws = null;
let wsReconnectTimer = null;

const defaultSettings = {
backgroundImage: null,
imageUrl: '',
imageFitMode: 'cover',
effectPreset: 'liquid',
effectIntensity: 50,
animationSpeed: 30,
mouseReactivity: 70,
particlesEnabled: true,
particleCount: 80,
particleColor: {'R': 102, 'G': 126, 'B': 234},

connectionDistance: 150,
showConnections: true,
primaryColor: '#667eea',
secondaryColor: '#764ba2',
glowColor: '#a5b4fc',
auroraEnabled: true,
showClock: true,
use24Hour: false,
showDate: true,
showGrades: true,
showAssignments: true,
clockSize: 6,
clockBgOpacity: 3,
clockBlur: 20,
clockBorderGlow: 30,
clockRadius: 30,
clockGlassEffect: true,
qualityLevel: 'high',
reduceMotion: false,
gpuAcceleration: true,
refreshInterval: 60,
// Auto-Scroll
autoScrollEnabled: true,
autoScrollSpeed: 1,
autoScrollDelay: 2,
autoScrollPause: 1,
autoScrollPauseOnHover: true,
// Panel Appearance
panelBlur: 40,
panelOpacity: 42,
borderGlow: 55,
panelRadius: 32,
panelGap: 40,
panelWidth: 400,
panelHoverEffect: true,
glassMorphism: true,
panelParallax: false,
panelParallaxIntensity: 15,
// Typography
fontFamily: "'Segoe UI', sans-serif",
gradeFontSize: 2.2,
courseNameSize: 0.86,
textOpacity: 85,
// Theme
themePreset: 'aurora',
// Alerts
highlightMissing: true,
pulseMissing: true,
showGradeChanges: true,
lowGradeThreshold: 70,
alertColor: '#f87171',
// Mouse
mouseGlowEnabled: true,
mouseGlowSize: 900,
mouseGlowOpacity: 20,
mouseGlowColor: '#667eea',
cursorTrail: false,
// Grades filter: 'current' | 's1' | 's2' | 'all'
gradesTermFilter: 'current'
};

let settings = { ...defaultSettings };

let latestGrades = null;
let latestAssignments = null;
let latestMissing = null;
const fallbackBackground = document.getElementById('fallback-background');

if (fallbackBackground) {
fallbackBackground.style.position = 'fixed';
fallbackBackground.style.inset = '0';
fallbackBackground.style.zIndex = '-3';
fallbackBackground.style.pointerEvents = 'none';
fallbackBackground.style.backgroundPosition = 'center center';
fallbackBackground.style.backgroundRepeat = 'no-repeat';
fallbackBackground.style.backgroundSize = 'cover';
fallbackBackground.style.opacity = '1';
fallbackBackground.style.display = SAFE_MODE ? 'block' : 'none';
}

async function loadSettings() {
// First load from localStorage for quick startup
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
    settings = { ...defaultSettings, ...JSON.parse(saved) };
    
    // Load background image from separate storage if needed
    if (settings.backgroundImage === '__STORED_SEPARATELY__') {
        const bgImage = localStorage.getItem(STORAGE_KEY + '_bgImage');
        if (bgImage) {
            settings.backgroundImage = bgImage;
        }
    }
}

// Always try to fetch latest settings from server (has the image URL)
try {
    const response = await fetch(BACKEND_URL + '/settings');
    if (response.ok) {
        const data = await response.json();
        if (data.settings) {
            // Merge server settings, prioritizing server's backgroundImage
            const serverBgImage = data.settings.backgroundImage;
            settings = { ...settings, ...data.settings };
            if (serverBgImage) {
                settings.backgroundImage = serverBgImage;
            }
            console.log('📥 Settings loaded from server, image:', serverBgImage ? serverBgImage.substring(0, 60) : 'none');
        }
    }
} catch (e) {
    console.log('Could not fetch settings from server, using local');
}

// Normalize particleColor if stored as array or string
if (settings.particleColor) {
    if (Array.isArray(settings.particleColor)) {
        const [r,g,b] = settings.particleColor;
        settings.particleColor = { R: r, G: g, B: b };
    } else if (typeof settings.particleColor === 'string') {
        // Handle hex strings or rgb() strings
        const s = settings.particleColor.trim();
        if (s.startsWith('#')) {
            const hex = s.replace('#','');
            const r = parseInt(hex.slice(0,2), 16);
            const g = parseInt(hex.slice(2,4), 16);
            const b = parseInt(hex.slice(4,6), 16);
            settings.particleColor = { R: r, G: g, B: b };
        } else if (s.startsWith('rgb')) {
            const parts = s.match(/\d+/g);
            if (parts && parts.length >= 3) {
                const r = parseInt(parts[0], 10);
                const g = parseInt(parts[1], 10);
                const b = parseInt(parts[2], 10);
                settings.particleColor = { R: r, G: g, B: b };
            }
        }
    }
}

applySettings();
}

function applySettings() {
const root = document.documentElement;

if (fallbackBackground) {
    fallbackBackground.style.display = SAFE_MODE ? 'block' : 'none';
    const fitMode = settings.imageFitMode || defaultSettings.imageFitMode;
    const fitMap = {
        cover: 'cover',
        contain: 'contain',
        fill: '100% 100%',
        none: 'auto'
    };
    fallbackBackground.style.backgroundSize = fitMap[fitMode] || 'cover';
}

// Clock settings
const clockEl = document.querySelector('.time-display .time');
if (clockEl) clockEl.style.fontSize = settings.clockSize + 'rem';

const timeDisplay = document.getElementById('timeDisplay');
if (timeDisplay) timeDisplay.style.display = settings.showClock ? 'block' : 'none';

const dateEl = document.querySelector('.time-display .date');
if (dateEl) dateEl.style.display = settings.showDate ? 'block' : 'none';

// Clock background opacity
const timeContainer = document.querySelector('.time-container');
if (timeContainer) {
    const bgOpacity = (settings.clockBgOpacity ?? 3) / 100;
    const blur = settings.clockBlur ?? 20;
    const borderGlow = (settings.clockBorderGlow ?? 30) / 100;
    const radius = settings.clockRadius ?? 30;
    const glowColor = settings.glowColor || '#a5b4fc';
    const glassEnabled = settings.clockGlassEffect !== false;
    
    // Use dark background like the panels (rgba(10, 10, 20))
    timeContainer.style.background = `linear-gradient(135deg, rgba(10, 10, 20, ${bgOpacity}) 0%, rgba(15, 15, 30, ${bgOpacity * 0.7}) 50%, rgba(10, 10, 20, ${bgOpacity}) 100%)`;
    timeContainer.style.backdropFilter = glassEnabled ? `blur(${blur}px) saturate(120%)` : 'none';
    timeContainer.style.webkitBackdropFilter = glassEnabled ? `blur(${blur}px) saturate(120%)` : 'none';
    timeContainer.style.borderRadius = `${radius}px`;
    
    // Calculate glow color with opacity
    const r = parseInt(glowColor.slice(1, 3), 16);
    const g = parseInt(glowColor.slice(3, 5), 16);
    const b = parseInt(glowColor.slice(5, 7), 16);
    timeContainer.style.boxShadow = `0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 ${borderGlow * 30}px rgba(${r}, ${g}, ${b}, ${borderGlow * 0.5})`;
    timeContainer.style.border = `1px solid rgba(255, 255, 255, ${0.03 + bgOpacity * 0.1})`;
}

// Panel visibility
const gradesPanel = document.getElementById('grades-panel');
if (gradesPanel) gradesPanel.style.display = settings.showGrades ? 'flex' : 'none';

const assignmentsPanel = document.getElementById('assignments-panel');
if (assignmentsPanel) assignmentsPanel.style.display = settings.showAssignments ? 'flex' : 'none';

// Reduce motion
document.body.classList.toggle('reduce-motion', !!settings.reduceMotion);

// Colors as CSS variables
root.style.setProperty('--accent1', settings.primaryColor || defaultSettings.primaryColor);
root.style.setProperty('--accent2', settings.secondaryColor || defaultSettings.secondaryColor);
root.style.setProperty('--accent3', settings.glowColor || defaultSettings.glowColor);
root.style.setProperty('--alert-color', settings.alertColor || defaultSettings.alertColor);

// Typography
root.style.setProperty('--font-family', settings.fontFamily || defaultSettings.fontFamily);
root.style.setProperty('--grade-font-size', (settings.gradeFontSize || defaultSettings.gradeFontSize) + 'rem');
root.style.setProperty('--course-name-size', (settings.courseNameSize || defaultSettings.courseNameSize) + 'rem');
root.style.setProperty('--text-opacity', (settings.textOpacity || defaultSettings.textOpacity) / 100);

// Apply font family to body
document.body.style.fontFamily = settings.fontFamily || defaultSettings.fontFamily;

// Panel Appearance
root.style.setProperty('--panel-blur', (settings.panelBlur || defaultSettings.panelBlur) + 'px');
root.style.setProperty('--panel-opacity', (settings.panelOpacity || defaultSettings.panelOpacity) / 100);
root.style.setProperty('--border-glow', (settings.borderGlow || defaultSettings.borderGlow) / 100);
root.style.setProperty('--panel-radius', (settings.panelRadius || defaultSettings.panelRadius) + 'px');
root.style.setProperty('--panel-gap', (settings.panelGap || defaultSettings.panelGap) + 'px');
root.style.setProperty('--panel-width', (settings.panelWidth || defaultSettings.panelWidth) + 'px');

// Panel hover effect
document.body.classList.toggle('no-panel-hover', !settings.panelHoverEffect);
document.body.classList.toggle('no-glass', !settings.glassMorphism);

// Panel parallax
if (typeof enableParallax === 'function') {
    enableParallax(settings.panelParallax);
}

// Mouse glow
const mouseGlows = document.querySelectorAll('.mouse-glow, .mouse-glow-secondary, .mouse-glow-tertiary');
mouseGlows.forEach(el => {
    el.style.display = settings.mouseGlowEnabled ? 'block' : 'none';
});

// Helper to convert hex to rgba
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const glowColor = settings.mouseGlowColor || '#667eea';

const primaryGlow = document.querySelector('.mouse-glow');
if (primaryGlow) {
    primaryGlow.style.width = settings.mouseGlowSize + 'px';
    primaryGlow.style.height = settings.mouseGlowSize + 'px';
    primaryGlow.style.opacity = settings.mouseGlowOpacity / 100;
    primaryGlow.style.background = `radial-gradient(circle, ${hexToRgba(glowColor, 0.2)} 0%, ${hexToRgba(glowColor, 0.15)} 25%, ${hexToRgba(glowColor, 0.08)} 50%, transparent 70%)`;
}

const secondaryGlow = document.querySelector('.mouse-glow-secondary');
if (secondaryGlow) {
    secondaryGlow.style.background = `radial-gradient(circle, ${hexToRgba(glowColor, 0.15)} 0%, ${hexToRgba(glowColor, 0.1)} 40%, transparent 70%)`;
}

const tertiaryGlow = document.querySelector('.mouse-glow-tertiary');
if (tertiaryGlow) {
    tertiaryGlow.style.background = `radial-gradient(circle, rgba(255,255,255,0.12) 0%, ${hexToRgba(glowColor, 0.08)} 40%, transparent 70%)`;
}

// Alert settings
root.style.setProperty('--highlight-missing', settings.highlightMissing ? '1' : '0');
document.body.classList.toggle('no-pulse-missing', !settings.pulseMissing);

// Re-initialize auto-scroll with new settings if needed
if (settings.autoScrollEnabled) {
    setTimeout(() => {
        initAutoScroll();
        initAutoScrollCourses();
    }, 100);
} else {
    // Stop auto-scroll
    const coursesList = document.getElementById('courses-section');
    const assignmentsList = document.getElementById('assignments-list');
    if (coursesList && coursesList._autoScrollInterval) {
        clearInterval(coursesList._autoScrollInterval);
        coursesList._autoScrollInterval = null;
    }
    if (assignmentsList && assignmentsList._autoScrollInterval) {
        clearInterval(assignmentsList._autoScrollInterval);
        assignmentsList._autoScrollInterval = null;
    }
    if (coursesList && coursesList._autoScrollFrame) {
        cancelAnimationFrame(coursesList._autoScrollFrame);
        coursesList._autoScrollFrame = null;
    }
    if (assignmentsList && assignmentsList._autoScrollFrame) {
        cancelAnimationFrame(assignmentsList._autoScrollFrame);
        assignmentsList._autoScrollFrame = null;
    }
    if (coursesList && coursesList._autoScrollPauseTimeout) {
        clearTimeout(coursesList._autoScrollPauseTimeout);
        coursesList._autoScrollPauseTimeout = null;
    }
    if (assignmentsList && assignmentsList._autoScrollPauseTimeout) {
        clearTimeout(assignmentsList._autoScrollPauseTimeout);
        assignmentsList._autoScrollPauseTimeout = null;
    }
    if (coursesList && coursesList._autoScrollRecalcInterval) {
        clearInterval(coursesList._autoScrollRecalcInterval);
        coursesList._autoScrollRecalcInterval = null;
    }
    if (assignmentsList && assignmentsList._autoScrollRecalcInterval) {
        clearInterval(assignmentsList._autoScrollRecalcInterval);
        assignmentsList._autoScrollRecalcInterval = null;
    }
}
}

// ============ THREE.JS LIQUID BACKGROUND ============
let scene, camera, renderer, material, mesh;
let mouseX = 0, mouseY = 0;
let targetMouseX = 0.5, targetMouseY = 0.5;
let startTime = Date.now();
// Track the last image source we loaded so we don't reload/reparse on unrelated setting changes
let lastLoadedSrc = null;
let lastLoadedImageUpdated = null;

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform float uIntensity;
uniform float uSpeed;
uniform float uMouseReactivity;
uniform sampler2D uTexture;
uniform int uHasTexture;
uniform float uTextureAspect;
uniform int uFitMode;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform int uPreset;

varying vec2 vUv;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
    vec2 uv = vUv;
    float time = uTime * uSpeed * 0.0008;
    
    vec2 mouseInfluence = (uMouse - 0.5) * uMouseReactivity * 0.008;
    float mouseDist = length(uv - uMouse);
    float mouseEffect = smoothstep(0.6, 0.0, mouseDist) * uMouseReactivity * 0.008;
    
    vec2 distortedUV = uv;
    
    if (uPreset == 0) {
        float noise1 = snoise(vec3(uv * 2.5, time * 0.4)) * uIntensity * 0.008;
        float noise2 = snoise(vec3(uv * 4.0 + 100.0, time * 0.25)) * uIntensity * 0.004;
        float mouseNoise = snoise(vec3(uv * 1.5 + mouseInfluence * 4.0, time * 0.8)) * mouseEffect;
        distortedUV.x += noise1 + noise2 + mouseNoise;
        distortedUV.y += noise1 * 0.7 + noise2 * 1.1 + mouseNoise;
    } else if (uPreset == 1) {
        float wave = sin(uv.x * 8.0 + time * 1.5) * cos(uv.y * 6.0 + time * 1.2);
        distortedUV += wave * uIntensity * 0.002 + mouseInfluence * mouseEffect * 2.0;
    } else if (uPreset == 2) {
        float dist = length(uv - uMouse);
        float ripple = sin(dist * 25.0 - time * 4.0) * exp(-dist * 2.5);
        vec2 dir = normalize(uv - uMouse + 0.001);
        distortedUV += dir * ripple * uIntensity * 0.008 * uMouseReactivity * 0.015;
    } else if (uPreset == 3) {
        float angle = atan(uv.y - 0.5, uv.x - 0.5);
        float radius = length(uv - 0.5);
        float twist = sin(radius * 8.0 - time * 1.5) * uIntensity * 0.008;
        distortedUV = vec2(0.5 + cos(angle + twist + mouseEffect) * radius, 0.5 + sin(angle + twist + mouseEffect) * radius);
    }
    
    distortedUV = clamp(distortedUV, 0.0, 1.0);
    
    vec4 color;
    if (uHasTexture == 1) {
        // Apply fit mode to UV coordinates
        vec2 texUV = distortedUV;
        float screenAspect = uResolution.x / uResolution.y;
        float ratio = screenAspect / uTextureAspect;
        
        if (uFitMode == 0) {
            // Cover: fill screen, crop excess
            if (ratio > 1.0) {
                texUV.y = (texUV.y - 0.5) / ratio + 0.5;
            } else {
                texUV.x = (texUV.x - 0.5) * ratio + 0.5;
            }
        } else if (uFitMode == 1) {
            // Contain: fit inside, letterbox
            if (ratio > 1.0) {
                texUV.x = (texUV.x - 0.5) * ratio + 0.5;
            } else {
                texUV.y = (texUV.y - 0.5) / ratio + 0.5;
            }
        } else if (uFitMode == 3) {
            // None: original size, centered
            texUV = (texUV - 0.5) * vec2(screenAspect, 1.0) / vec2(uTextureAspect, 1.0) + 0.5;
        }
        // FitMode 2 (fill): use distortedUV as-is (stretches to fit)
        
        // Check if UV is out of bounds (for contain/none modes)
        if (texUV.x < 0.0 || texUV.x > 1.0 || texUV.y < 0.0 || texUV.y > 1.0) {
            // Show gradient background for letterboxed areas
            float noise = snoise(vec3(distortedUV * 1.5, time * 0.15)) * 0.5 + 0.5;
            float gradient = distortedUV.x * 0.4 + distortedUV.y * 0.4 + noise * 0.25;
            color.rgb = mix(vec3(0.02, 0.02, 0.04), mix(uColor1, uColor2, gradient), 0.45 + noise * 0.35);
            color.a = 1.0;
        } else {
            color = texture2D(uTexture, texUV);
        }
    } else {
        float noise = snoise(vec3(distortedUV * 1.5, time * 0.15)) * 0.5 + 0.5;
        float gradient = distortedUV.x * 0.4 + distortedUV.y * 0.4 + noise * 0.25;
        vec3 col1 = uColor1;
        vec3 col2 = uColor2;
        vec3 col3 = vec3(0.02, 0.02, 0.04);
        color.rgb = mix(col3, mix(col1, col2, gradient), 0.45 + noise * 0.35);
        float glow = smoothstep(0.5, 0.0, mouseDist) * uMouseReactivity * 0.006;
        color.rgb += vec3(0.08, 0.06, 0.12) * glow;
        color.a = 1.0;
    }
    
    float vignette = 1.0 - smoothstep(0.4, 1.6, length(uv - 0.5) * 1.4);
    color.rgb *= vignette;
    
    gl_FragColor = color;
}
`;

function initThreeJS() {
if (SAFE_MODE) {
    const threeContainer = document.getElementById('three-container');
    if (threeContainer) threeContainer.style.display = 'none';
    return;
}

scene = new THREE.Scene();
camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('three-container').appendChild(renderer.domElement);

const color1 = new THREE.Color(settings.primaryColor);
const color2 = new THREE.Color(settings.secondaryColor);

material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uIntensity: { value: settings.effectIntensity },
        uSpeed: { value: settings.animationSpeed },
        uMouseReactivity: { value: settings.mouseReactivity },
        uTexture: { value: null },
        uHasTexture: { value: 0 },
        uTextureAspect: { value: 1.0 },
        uFitMode: { value: 0 }, // 0=cover, 1=contain, 2=fill, 3=none
        uColor1: { value: new THREE.Vector3(color1.r, color1.g, color1.b) },
        uColor2: { value: new THREE.Vector3(color2.r, color2.g, color2.b) },
        uPreset: { value: getPresetIndex(settings.effectPreset) }
    },
    vertexShader,
    fragmentShader
});

mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(mesh);
loadBackgroundImage();
}

function getPresetIndex(preset) {
return { liquid: 0, wave: 1, ripple: 2, distort: 3, none: 4, custom: 0 }[preset] || 0;
}

function getFitModeIndex(mode) {
return { cover: 0, contain: 1, fill: 2, none: 3 }[mode] || 0;
}

// For animated GIF support
let gifCanvas = null;
let gifCtx = null;
let gifTexture = null;
let gifImage = null;
let gifAnimationFrame = null;
let currentTexture = null; // Track current texture for cleanup
let activeGifEntry = null;

// Cache parsed GIFs to avoid reparsing and speed up subsequent loads.
// Key: source URL (blob: or original url). Value: { texture, canvas, rub, timerId, start(), stop() }
const gifCache = new Map();

// Maximum number of cached GIFs to keep in memory. Older entries will be evicted
// and fully disposed (textures revoked) to prevent unbounded memory growth when
// settings change frequently and new blob URLs are generated.
const MAX_GIF_CACHE = 3;

function pruneGifCache(maxEntries = MAX_GIF_CACHE) {
    try {
        while (gifCache.size > maxEntries) {
            const oldestKey = gifCache.keys().next().value;
            const entry = gifCache.get(oldestKey);
            if (entry) {
                try {
                    if (typeof entry.stop === 'function') entry.stop();
                } catch (e) { console.warn('Error stopping gif cache entry', e); }
                try {
                    if (entry.frameId) cancelAnimationFrame(entry.frameId);
                    if (entry.timerId) clearTimeout(entry.timerId);
                } catch (e) {}
                try {
                    if (entry.texture && typeof entry.texture.dispose === 'function') entry.texture.dispose();
                } catch (e) { console.warn('Error disposing gif texture', e); }
                if (activeGifEntry === entry) {
                    activeGifEntry = null;
                }
                // If the cache key is a blob URL, revoke it to free browser memory
                try {
                    if (typeof oldestKey === 'string' && oldestKey.startsWith('blob:')) {
                        URL.revokeObjectURL(oldestKey);
                    }
                } catch (e) { console.warn('Error revoking objectURL', e); }
            }
            gifCache.delete(oldestKey);
        }
    } catch (e) {
        console.warn('pruneGifCache failed', e);
    }
}

function isTextureInGifCache(tex) {
    for (const v of gifCache.values()) {
        if (v.texture === tex) return true;
    }
    return false;
}

function stopActiveGifAnimation() {
    if (activeGifEntry && typeof activeGifEntry.stop === 'function') {
        activeGifEntry.stop();
    }
    activeGifEntry = null;
    gifAnimationFrame = null;
}

function cleanupTexture() {
    stopActiveGifAnimation();
    // Dispose old texture to prevent memory leaks, but don't dispose textures
    // that are stored in the gifCache (we reuse those).
    if (currentTexture) {
        if (!isTextureInGifCache(currentTexture)) {
            try { currentTexture.dispose(); } catch (e) { console.warn(e); }
        }
        currentTexture = null;
    }
    if (gifTexture) {
        if (!isTextureInGifCache(gifTexture)) {
            try { gifTexture.dispose(); } catch (e) { console.warn(e); }
        }
        gifTexture = null;
    }
}

async function loadBackgroundImage() {
const src = settings.backgroundImage || settings.imageUrl;

if (SAFE_MODE) {
    applyFallbackBackgroundImage(src);
    return;
}

// Safety Check: Engine must be ready
if (!material || !material.uniforms) return;

// If the source hasn't changed since last load, avoid reloading/parsing textures
// However, if the image-updated timestamp changed, force reload even when src is identical
const imageUpdated = settings['image-updated'] || settings.imageUpdated || null;
if (src && lastLoadedSrc === src && lastLoadedImageUpdated === imageUpdated) {
    // Still update fit mode/uniforms in case only UI settings changed
    material.uniforms.uFitMode.value = getFitModeIndex(settings.imageFitMode);
    material.uniforms.uTextureAspect.value = material.uniforms.uTextureAspect.value || 1.0;
    console.log('🖼️ Image source unchanged and timestamp unchanged, skipping reload.');
    return;
}

function applyFallbackBackgroundImage(src) {
if (!fallbackBackground) return;

if (!src) {
    fallbackBackground.style.backgroundImage = 'none';
    fallbackBackground.style.backgroundColor = '#000';
    return;
}

fallbackBackground.style.backgroundColor = 'transparent';
fallbackBackground.style.backgroundImage = `url("${src.replace(/"/g, '%22')}")`;
}

console.log('🖼️ New image detected, loading...', src);

// 1. Cleanup previous textures/animations
cleanupTexture();
const existingContainer = document.getElementById('gif-animation-container');
if (existingContainer) existingContainer.remove();

if (!src) {
    // If clearing the wallpaper, dispose any existing textures and clear cache references
    lastLoadedSrc = null;
    material.uniforms.uHasTexture.value = 0;
    material.uniforms.uTexture.value = null;
    cleanupTexture();
    return;
}

// 2. Handle Data URIs (Base64) normally
if (src.startsWith('data:')) {
    loadImageTexture(src);
    return;
}

// 3. Handle Localhost/Http URLs via Blob to force reload
try {
    // Fetch with cache: 'reload' forces the browser to check the server
    const response = await fetch(src, { cache: 'reload' });
    
    if (!response.ok) throw new Error('Network response was not ok');
    
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    
    // Determine if it is a GIF based on the blob type
    const isGif = blob.type === 'image/gif';

    if (isGif) {
        loadAnimatedGif(objectURL);
        lastLoadedSrc = objectURL;
        lastLoadedImageUpdated = imageUpdated || Date.now();
    } else {
        loadImageTexture(objectURL);
        lastLoadedSrc = objectURL;
        lastLoadedImageUpdated = imageUpdated || Date.now();
    }
} catch (err) {
    console.error('❌ Failed to fetch image blob:', err);
    // Fallback: try loading directly if fetch fails
    loadImageTexture(src);
}
}

// Helper function to handle standard image loading
function loadImageTexture(finalSrc) {
const img = new Image();
// Don't set crossOrigin for ObjectURLs (blobs) or Data URIs
if (!finalSrc.startsWith('blob:') && !finalSrc.startsWith('data:')) {
    img.crossOrigin = 'anonymous';
}

img.onload = function() {
    if (currentTexture) currentTexture.dispose();

    const texture = new THREE.Texture(img);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    currentTexture = texture;
    
    material.uniforms.uTexture.value = texture;
    material.uniforms.uHasTexture.value = 1;
    material.uniforms.uTextureAspect.value = img.width / img.height;
    material.uniforms.uFitMode.value = getFitModeIndex(settings.imageFitMode);

    // If we used a blob URL, revoke it to free memory
    if (finalSrc.startsWith('blob:')) {
        URL.revokeObjectURL(finalSrc);
    }
    // record that we successfully loaded this source and the image-updated timestamp
    try {
        lastLoadedSrc = finalSrc;
        lastLoadedImageUpdated = settings['image-updated'] || settings.imageUpdated || Date.now();
    } catch (e) {}
};

img.onerror = function() {
    console.error('❌ Failed to load image texture');
};

img.src = finalSrc;
}

function loadAnimatedGif(blobUrl) {
    // Wait for library to load
    if (typeof SuperGif === 'undefined') {
        console.log('⏳ LibGif not ready yet... waiting.');
        setTimeout(() => loadAnimatedGif(blobUrl), 100);
        return;
    }

    // If we already parsed this GIF, reuse cached texture and animation
    const cached = gifCache.get(blobUrl);
    if (cached) {
        console.log('🎞️ Using cached GIF for', blobUrl);

        // Stop any running global gifAnimationFrame; we'll use cached control
        if (gifAnimationFrame) { cancelAnimationFrame(gifAnimationFrame); gifAnimationFrame = null; }

        currentTexture = cached.texture;
        gifTexture = cached.texture;
        material.uniforms.uTexture.value = cached.texture;
        material.uniforms.uHasTexture.value = 1;
        material.uniforms.uTextureAspect.value = cached.canvas.width / cached.canvas.height;
        material.uniforms.uFitMode.value = getFitModeIndex(settings.imageFitMode);

        // record loaded source/timestamp so we can detect content changes
        lastLoadedSrc = blobUrl;
        lastLoadedImageUpdated = settings['image-updated'] || settings.imageUpdated || Date.now();

        if (typeof cached.start === 'function') cached.start();
        return;
    }

    console.log('🎞️ Initializing GIF animation (Native Speed Mode)...', blobUrl);

    const img = document.createElement('img');
    img.src = blobUrl;

    // Manual Drive
    img.setAttribute('rel:auto_play', '0');
    img.setAttribute('rel:rubbable', '0');

    const div = document.createElement('div');
    div.id = 'gif-animation-container';
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.visibility = 'hidden';
    div.appendChild(img);
    document.body.appendChild(div);

    const rub = new SuperGif({ gif: img });

    rub.load(() => {
        console.log('✅ GIF Parsed. Starting playback.');

        const canvas = rub.get_canvas();

        // Dispose old texture if not cached
        if (currentTexture && !isTextureInGifCache(currentTexture)) {
            try { currentTexture.dispose(); } catch (e) { console.warn(e); }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;

        currentTexture = texture;
        gifTexture = texture;

        material.uniforms.uTexture.value = texture;
        material.uniforms.uHasTexture.value = 1;
        material.uniforms.uTextureAspect.value = canvas.width / canvas.height;
        material.uniforms.uFitMode.value = getFitModeIndex(settings.imageFitMode);

        // Cache parsed GIF to speed up future loads
        const cacheEntry = {
            texture,
            canvas,
            rub,
            timerId: null,
            frameId: null,
            start() {
                if (activeGifEntry && activeGifEntry !== this) {
                    activeGifEntry.stop();
                }
                if (this.timerId || this.frameId) return;

                activeGifEntry = this;
                this._currentDelay = 50;

                const scheduleNext = (delayMs) => {
                    this.timerId = setTimeout(() => {
                        this.timerId = null;

                        // Stop immediately if this GIF is no longer the active texture.
                        if (activeGifEntry !== this || currentTexture !== this.texture) {
                            this.stop();
                            if (div && div.parentNode) div.remove();
                            return;
                        }

                        rub.move_relative(1);
                        this.texture.needsUpdate = true;

                        const idx = rub.get_current_frame();
                        const frames = rub.get_frames();
                        if (frames && frames[idx]) {
                            this._currentDelay = Math.max(30, (frames[idx].delay * 10) || 30);
                        }

                        scheduleNext(this._currentDelay);
                    }, Math.max(0, delayMs));
                };

                scheduleNext(0);
            },
            stop() {
                if (this.timerId) { clearTimeout(this.timerId); this.timerId = null; }
                if (this.frameId) { cancelAnimationFrame(this.frameId); this.frameId = null; }
                if (activeGifEntry === this) {
                    activeGifEntry = null;
                }
            }
        };

        // Attach blob key and start local animator then store in cache
        cacheEntry._blobUrl = blobUrl;
        cacheEntry.start();
        gifCache.set(blobUrl, cacheEntry);

        // Evict old cache entries if cache grows too large to avoid memory leaks
        pruneGifCache();

        // Also keep global references for compatibility
        gifAnimationFrame = cacheEntry.timerId;
    });
}

function animateThreeJS() {
if (SAFE_MODE || !renderer || !material) return;

if (!settings.reduceMotion) {
    material.uniforms.uTime.value = Date.now() - startTime;
    mouseX += (targetMouseX - mouseX) * 0.04;
    mouseY += (targetMouseY - mouseY) * 0.04;
    material.uniforms.uMouse.value.set(mouseX, mouseY);
}
renderer.render(scene, camera);
requestAnimationFrame(animateThreeJS);
}

// ============ PARTICLE SYSTEM ============
const particleCanvas = document.getElementById('particle-canvas');
const ctx = particleCanvas.getContext('2d');
let particles = [];

class Particle {
constructor() {
    this.reset();
}
reset() {
    this.x = Math.random() * particleCanvas.width;
    this.y = Math.random() * particleCanvas.height;
    this.vx = (Math.random() - 0.5) * 0.3;
    this.vy = (Math.random() - 0.5) * 0.3;
    this.radius = Math.random() * 1.5 + 0.5;
    this.alpha = Math.random() * 0.3 + 0.1;
}
update() {
    const dx = targetMouseX * particleCanvas.width - this.x;
    const dy = (1 - targetMouseY) * particleCanvas.height - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 200) {
        const force = (200 - dist) / 200;
        this.vx += (dx / dist) * force * 0.01;
        this.vy += (dy / dist) * force * 0.01;
    }
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.99;
    this.vy *= 0.99;
    if (this.x < 0 || this.x > particleCanvas.width || this.y < 0 || this.y > particleCanvas.height) {
        this.reset();
    }
}
draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${settings.particleColor.R}, ${settings.particleColor.G}, ${settings.particleColor.B}, ${this.alpha})`;
    ctx.fill();
}
}

function initParticles() {
if (SAFE_MODE) {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
    particles = [];
    return;
}

particleCanvas.width = window.innerWidth;
particleCanvas.height = window.innerHeight;
particles = [];
if (settings.particlesEnabled) {
    for (let i = 0; i < settings.particleCount; i++) {
        particles.push(new Particle());
    }
}
}

function animateParticles() {
if (SAFE_MODE) {
ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
return;
}

ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
if (settings.particlesEnabled && !settings.reduceMotion) {
    if (settings.showConnections) {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < settings.connectionDistance) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(${settings.particleColor.R}, ${settings.particleColor.G}, ${settings.particleColor.B}, ${(1 - dist / settings.connectionDistance) * 0.08})`;
                    ctx.stroke();
                }
            }
        }
    }
    particles.forEach(p => { p.update(); p.draw(); });
}
requestAnimationFrame(animateParticles);
}

// ============ MOUSE TRACKING ============
const mouseGlow = document.getElementById('mouseGlow');
const mouseGlowSecondary = document.getElementById('mouseGlowSecondary');
const mouseGlowTertiary = document.getElementById('mouseGlowTertiary');
const dashboard = document.querySelector('.dashboard');
const timeDisplay = document.getElementById('timeDisplay');
const gradesPanel = document.getElementById('grades-panel');
const assignmentsPanel = document.getElementById('assignments-panel');

// Parallax using CSS transitions (GPU accelerated)
function applyParallax(mouseX, mouseY) {
if (!settings.panelParallax) return;

const intensity = settings.panelParallaxIntensity || 15;

// Normalized mouse position (-1 to 1)
const normX = (mouseX / window.innerWidth - 0.5) * 2;
const normY = (mouseY / window.innerHeight - 0.5) * 2;

// Proximity factors: original reach
const closerFactor = 1.5;
const fartherFactor = 0.5;
const centerX = window.innerWidth / 2;
const mouseOnLeft = mouseX < centerX;

// Dynamic Y: left panel is higher if mouse is lower right, right panel is higher if mouse is lower left
// This is achieved by blending the Y offset with the X position
// When mouse is far right, left panel Y is more negative (higher), right panel Y is more positive (lower)
// When mouse is far left, right panel Y is more negative (higher), left panel Y is more positive (lower)
const ySpread = normX * normY * intensity * 1.5; // Increased spread factor for more effect
const baseY = normY * intensity;
const gradesY = baseY - ySpread;
const assignY = baseY + ySpread;

if (gradesPanel) {
    const gx = normX * intensity * (mouseOnLeft ? closerFactor : fartherFactor);
    gradesPanel.style.transform = `translate3d(${gx}px, ${gradesY}px, 0)`;
}
if (assignmentsPanel) {
    const ax = normX * intensity * (mouseOnLeft ? fartherFactor : closerFactor);
    assignmentsPanel.style.transform = `translate3d(${ax}px, ${assignY}px, 0)`;
}
if (timeDisplay) {
    const titleIntensity = 0.5; // Reduced intensity for title
    const tx = normX * intensity * titleIntensity * (fartherFactor + closerFactor) / 2;
    timeDisplay.style.transform = `translate3d(calc(-50% + ${tx}px), ${((assignY + gradesY) / 2) * titleIntensity}px, 0)`;
}
// if (timeDisplay) {
//     const tx = normX * intensity * 0.5;
//     timeDisplay.style.transform = `translateX(calc(-50% + ${tx}px))`;
// }
}

function enableParallax(enabled) {
if (gradesPanel) gradesPanel.classList.toggle('parallax-enabled', enabled);
if (assignmentsPanel) assignmentsPanel.classList.toggle('parallax-enabled', enabled);
if (timeDisplay) timeDisplay.classList.toggle('parallax-enabled', enabled);

if (!enabled) {
    if (gradesPanel) gradesPanel.style.transform = '';
    if (assignmentsPanel) assignmentsPanel.style.transform = '';
    if (timeDisplay) timeDisplay.style.transform = 'translateX(-50%)';
}
}

// Initialize parallax state
enableParallax(settings.panelParallax);

document.addEventListener('mousemove', (e) => {
targetMouseX = e.clientX / window.innerWidth;
targetMouseY = 1 - (e.clientY / window.innerHeight);

// Apply parallax with CSS transitions
if (settings.panelParallax) {
    applyParallax(e.clientX, e.clientY);
}

mouseGlow.style.left = e.clientX + 'px';
mouseGlow.style.top = e.clientY + 'px';

setTimeout(() => {
    mouseGlowSecondary.style.left = e.clientX + 'px';
    mouseGlowSecondary.style.top = e.clientY + 'px';
}, 60);

setTimeout(() => {
    mouseGlowTertiary.style.left = e.clientX + 'px';
    mouseGlowTertiary.style.top = e.clientY + 'px';
}, 20);
});

window.addEventListener('resize', () => {
particleCanvas.width = window.innerWidth;
particleCanvas.height = window.innerHeight;
if (renderer) renderer.setSize(window.innerWidth, window.innerHeight);
if (material && material.uniforms && material.uniforms.uResolution) {
    material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}
layoutScrollers();
});


// ============ CLOCK ============
function updateClock() {
const now = new Date();
let hours = now.getHours();
const minutes = now.getMinutes().toString().padStart(2, '0');
if (!settings.use24Hour) hours = hours % 12 || 12;
document.getElementById('clock').textContent = `${hours.toString().padStart(2, '0')}:${minutes}`;
if (settings.showDate) {
    document.getElementById('date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
}

// ============ DATA DISPLAY ============
function normalizeCourseName(name) {
return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getRecentCourseScores(courseName, assignments, maxPoints = 10) {
if (!assignments || !assignments.length) return [];

const target = normalizeCourseName(courseName);
const filtered = assignments
    .filter(a => !a.missing && a.score !== null && a.scorePercentage !== null)
    .filter(a => {
        const aName = normalizeCourseName(a.courseName);
        return aName === target || aName.includes(target) || target.includes(aName);
    })
    .sort((a, b) => new Date(a.scoreModifiedDate) - new Date(b.scoreModifiedDate));

const values = filtered
    .map(a => Number.parseFloat(a.scorePercentage))
    .filter(n => Number.isFinite(n));

return values.slice(Math.max(0, values.length - maxPoints));
}

function buildSparklineSVG(values, gradeClass) {
const width = 96;
const height = 28;
const padX = 2;
const padY = 3;

const color = gradeClass === 'a' ? '#4ade80' : gradeClass === 'b' ? '#fbbf24' : '#f87171';
const fill = gradeClass === 'a' ? 'rgba(74, 222, 128, 0.32)' : gradeClass === 'b' ? 'rgba(251, 191, 36, 0.30)' : 'rgba(248, 113, 113, 0.26)';

if (!values || values.length < 2) {
    return `<svg class="sparkline grade-${gradeClass}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
        <path class="spark-line" d="M${padX} ${height - padY} L${width - padX} ${height - padY}" opacity="0.30" stroke="${color}"></path>
    </svg>`;
}

const min = Math.min(...values);
const max = Math.max(...values);
const safeRange = Math.max(8, max - min);

const xStep = (width - padX * 2) / (values.length - 1);
const points = values.map((v, i) => {
    const x = padX + i * xStep;
    const t = (v - min) / safeRange;
    const y = (height - padY) - t * (height - padY * 2);
    return [x, y];
});

const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
const areaD = `${lineD} L${points[points.length - 1][0].toFixed(2)} ${(height - padY).toFixed(2)} L${points[0][0].toFixed(2)} ${(height - padY).toFixed(2)} Z`;

const last = points[points.length - 1];

return `<svg class="sparkline grade-${gradeClass}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
    <path class="spark-area" d="${areaD}" fill="${fill}"></path>
    <path class="spark-line" d="${lineD}" stroke="${color}"></path>
    <circle cx="${last[0].toFixed(2)}" cy="${last[1].toFixed(2)}" r="2.2" fill="rgba(255,255,255,0.85)" opacity="0.65"></circle>
</svg>`;
}

function displayGrades(data, assignments) {
if (!data || !data.length) {
    return `<div class="error-state"><p>No grade data available</p><a href="https://410.ncsis.gov/campus/SSO/psu410guilfordco/sis?configID=1" target="_blank" class="login-btn">Log In to NCEdCloud</a></div>`;
}

const enrollment = Array.isArray(data) ? data[0] : data;
const terms = [...(enrollment?.terms || [])].sort((a, b) => a.termSeq - b.termSeq);

function getGradeValue(task) {
    const rawValue = task?.progressScore ?? task?.score;
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        return null;
    }

    const numericValue = Number.parseInt(rawValue, 10);
    return Number.isNaN(numericValue) ? null : numericValue;
}

function findTermGradeTask(course, term) {
    if (!course?.gradingTasks?.length || !term) {
        return null;
    }

    return course.gradingTasks.find((task) => {
        if (task.taskID !== 2) {
            return false;
        }
        if (getGradeValue(task) === null) {
            return false;
        }
        if (term.termID && task.termID === term.termID) {
            return true;
        }
        return task.termSeq === term.termSeq;
    }) || null;
}

function getCurrentTermSeq() {
    if (!terms.length) {
        return 1;
    }

    const now = new Date();
    const activeTerm = terms.find((term) => {
        const start = term.startDate ? new Date(term.startDate) : null;
        const end = term.endDate ? new Date(term.endDate) : null;
        return start && end && now >= start && now <= end;
    });

    if (activeTerm) {
        return activeTerm.termSeq;
    }

    const gradedTerm = [...terms]
        .sort((a, b) => b.termSeq - a.termSeq)
        .find((term) => (term.courses || []).some((course) => findTermGradeTask(course, term)));

    return gradedTerm?.termSeq || terms[terms.length - 1]?.termSeq || 1;
}

const currentTermSeq = getCurrentTermSeq();

const filter = (settings && settings.gradesTermFilter) || 'current';
const filterSeqs = filter === 's1' ? [1, 2] : filter === 's2' ? [3, 4] : filter === 'all' ? [1, 2, 3, 4] : null;
const termNames = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };
const filterLabel = filter === 's1' ? 'Sem 1' : filter === 's2' ? 'Sem 2' : filter === 'all' ? 'All' : termNames[currentTermSeq];

// Build one entry per course from the authoritative term course lists.
const courseEntries = [];
const seenCourseKeys = new Set();
const orderedTerms = [...terms].sort((a, b) => b.termSeq - a.termSeq);
orderedTerms.forEach((term) => {
    if (filterSeqs && !filterSeqs.includes(term.termSeq)) {
        return;
    }

    (term.courses || []).forEach((course) => {
        if (course.dropped) {
            return;
        }

        const task = findTermGradeTask(course, term);
        if (!task) {
            return;
        }

        const courseKey = String(course.courseID || course.sectionID || course.courseName);
        if (seenCourseKeys.has(courseKey)) {
            return;
        }

        if (!filterSeqs && term.termSeq > currentTermSeq) {
            return;
        }

        seenCourseKeys.add(courseKey);
        courseEntries.push({ course, task, termSeq: term.termSeq });
    });
});

let total = 0, aCount = 0, bCount = 0, cCount = 0;
const statsEntries = filter === 'current'
    ? courseEntries.filter(entry => entry.termSeq === currentTermSeq)
    : courseEntries;

statsEntries.forEach(({ task }) => {
    const score = getGradeValue(task);
    total += score;
    if (score >= 90) aCount++;
    else if (score >= 80) bCount++;
    else cCount++;
});
const count = statsEntries.length;
const avg = count > 0 ? (total / count).toFixed(1) : 0;
const circumference = 2 * Math.PI * 54;
const progress = (avg / 100) * circumference;

let html = `
    <div class="grade-overview">
        <div class="grade-ring-container">
            <svg class="grade-ring" viewBox="0 0 120 120">
                <circle class="grade-ring-bg" cx="60" cy="60" r="54"/>
                <circle class="grade-ring-progress" cx="60" cy="60" r="54" 
                    stroke-dasharray="${circumference}" 
                    stroke-dashoffset="${circumference - progress}"/>
            </svg>
            <div class="grade-center">
                <div class="grade-value">${avg}%</div>
                <div class="grade-label">${filterLabel} Avg</div>
            </div>
        </div>
        <div class="grade-stats">
            <div class="stat-row">
                <span class="stat-label">A's (90+)</span>
                <span class="stat-value grade-a">${aCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">B's (80-89)</span>
                <span class="stat-value grade-b">${bCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">C's or below</span>
                <span class="stat-value grade-c">${cCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Total Courses</span>
                <span class="stat-value">${count}</span>
            </div>
            <div class="dist-bar" aria-hidden="true">
                <div class="dist-seg a" style="flex: ${aCount}"></div>
                <div class="dist-seg b" style="flex: ${bCount}"></div>
                <div class="dist-seg c" style="flex: ${cCount}"></div>
            </div>
        </div>
    </div>
    <div id="courses-section" class="courses-section">
`;

// Group entries by termSeq for section headers
const groups = {};
courseEntries.forEach(e => {
    if (!groups[e.termSeq]) groups[e.termSeq] = [];
    groups[e.termSeq].push(e);
});
const sortedSeqs = Object.keys(groups).map(Number).sort((a, b) => b - a);
const showHeaders = sortedSeqs.length > 1;

sortedSeqs.forEach(seq => {
    if (showHeaders) {
        const isCurrent = seq === currentTermSeq;
        html += `<div class="quarter-section-header${isCurrent ? ' current' : ''}">${termNames[seq]}${isCurrent ? ' · Current' : ''}</div>`;
    }
    groups[seq].forEach(({ course: c, task }) => {
        const score = getGradeValue(task);
        const gradeClass = score >= 90 ? 'a' : score >= 80 ? 'b' : 'c';
        const recent = getRecentCourseScores(c.courseName, assignments, 10);
        const spark = buildSparklineSVG(recent, gradeClass);
        html += `
            <div class="course-bar-item">
                <div class="course-card">
                    <div class="course-card-top">
                        <div class="course-title">
                            <div class="course-name">${c.courseName}</div>
                            <div class="course-sub">Recent trend</div>
                        </div>
                        <div class="course-grade-pill grade-${gradeClass}">${score}%</div>
                    </div>
                    <div class="course-card-bottom">
                        <div class="course-bar">
                            <div class="course-bar-fill bar-gradient-${gradeClass}" style="width: ${score}%"></div>
                        </div>
                        <div class="course-sparkline">${spark}</div>
                    </div>
                </div>
            </div>
        `;
    });
});

html += '</div>';
return html;
}

function displayAssignments(assignments, missingData) {
if (!assignments || !assignments.length) {
    return `<div class="error-state"><p>No recent assignments</p></div>`;
}

const sorted = [...assignments].sort((a, b) => new Date(b.scoreModifiedDate) - new Date(a.scoreModifiedDate));
const getAssignmentKey = (assignment) => [
    assignment.assignmentID ?? assignment.assignmentName ?? '',
    assignment.sectionID ?? assignment.courseName ?? '',
    assignment.dueDate ?? assignment.scoreModifiedDate ?? ''
].join('|');
const sortMissingAssignments = (left, right) => {
    const leftDate = new Date(left.dueDate || left.scoreModifiedDate || 0).getTime();
    const rightDate = new Date(right.dueDate || right.scoreModifiedDate || 0).getTime();
    return leftDate - rightDate;
};

const dedicatedMissing = Array.isArray(missingData?.missingAssignments)
    ? [...missingData.missingAssignments].sort(sortMissingAssignments).map(assignment => ({ ...assignment, missing: true, _dedicated: true }))
    : [];
const recentMissing = sorted
    .filter(assignment => assignment.missing)
    .sort(sortMissingAssignments);
const scored = sorted.filter(a => a.score !== null && !a.missing);
const hasDedicatedMissing = Number.isFinite(missingData?.missingAssignmentsTotal) || dedicatedMissing.length > 0;
const missingCount = Math.max(
    Number.isFinite(missingData?.missingAssignmentsTotal) ? missingData.missingAssignmentsTotal : 0,
    dedicatedMissing.length,
    recentMissing.length
);
const missingCountLabel = missingCount === 0 && missingData?.hasOtherMissing ? '1+' : String(missingCount);
const avg = scored.length ? (scored.reduce((s, a) => s + parseFloat(a.scorePercentage), 0) / scored.length).toFixed(0) : 'N/A';

let html = `
    <div class="assignments-header-stats">
        <div class="mini-stat">
            <div class="mini-stat-value avg">${avg}%</div>
            <div class="mini-stat-label">Average</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-value missing">${missingCountLabel}</div>
            <div class="mini-stat-label">Missing</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-value recent">${sorted.length}</div>
            <div class="mini-stat-label">Recent</div>
        </div>
    </div>
    <div id="assignments-list" class="assignments-list">
`;

// Build display list: dedicated missing items first, then recent missing fallbacks, then recent scored.
const seenKeys = new Set();
const prioritizedMissing = [];
const recentScored = [];

for (const assignment of [...dedicatedMissing, ...recentMissing]) {
    const key = getAssignmentKey(assignment);
    if (!seenKeys.has(key)) {
        seenKeys.add(key);
        prioritizedMissing.push(assignment);
    }
}

for (const assignment of scored) {
    const key = getAssignmentKey(assignment);
    if (!seenKeys.has(key)) {
        seenKeys.add(key);
        recentScored.push(assignment);
    }
}

const renderAssignmentItem = (a) => {
    const score = (a.score !== null && a.score !== undefined) ? parseFloat(a.scorePercentage || 0).toFixed(0) : 0;
    const circumference = 2 * Math.PI * 18;
    const progress = a.missing ? 0 : (score / 100) * circumference;
    const strokeColor = a.missing ? '#f87171' : score >= 90 ? '#4ade80' : score >= 80 ? '#fbbf24' : '#f87171';
    const textColor = a.missing ? '#f87171' : score >= 90 ? '#4ade80' : score >= 80 ? '#fbbf24' : '#f87171';
    const date = a._dedicated
        ? (a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No due date')
        : new Date(a.scoreModifiedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return `
        <div class="assignment-item ${a.missing ? 'missing' : ''}">
            <div class="assignment-score-ring">
                <svg class="assignment-ring" viewBox="0 0 44 44">
                    <circle class="assignment-ring-bg" cx="22" cy="22" r="18"/>
                    <circle class="assignment-ring-progress" cx="22" cy="22" r="18" 
                        stroke="${strokeColor}"
                        stroke-dasharray="${circumference}" 
                        stroke-dashoffset="${circumference - progress}"/>
                </svg>
                <span class="assignment-score-value" style="color: ${textColor}">${a.missing ? 'M' : score + '%'}</span>
            </div>
            <div class="assignment-details">
                <div class="assignment-name">${a.assignmentName}</div>
                <div class="assignment-meta">
                    <span class="assignment-course-tag">${a.courseName}</span>
                    ${a.missing ? '<span class="missing-badge">Missing</span>' : ''}
                    <span>${date}</span>
                </div>
            </div>
        </div>
    `;
};

if (prioritizedMissing.length) {
    html += `<div class="assignment-group-label">Missing Work</div>`;
    prioritizedMissing.forEach(assignment => {
        html += renderAssignmentItem(assignment);
    });
}

if (recentScored.length) {
    if (prioritizedMissing.length) {
        html += `<div class="assignment-group-label secondary">Recent Activity</div>`;
    }
    recentScored.slice(0, 20).forEach(assignment => {
        html += renderAssignmentItem(assignment);
    });
}

html += '</div>';
return html;
}

function restoreScroll(el, prev) {
if (!el) return;
const max = Math.max(0, el.scrollHeight - el.clientHeight);
el.scrollTop = Math.min(prev, max);
}

function layoutScrollers() {
// Grades: make the course list take the remaining space under the overview.
const gradesPanel = document.getElementById('grades-panel');
const gradesHeader = gradesPanel?.querySelector('.panel-header');
const gradesContent = document.getElementById('grades-content');
const overview = gradesContent?.querySelector('.grade-overview');
const courses = gradesContent?.querySelector('.courses-section');

if (gradesPanel && gradesHeader && gradesContent && overview && courses) {
    const panelH = gradesPanel.clientHeight;
    const headerH = gradesHeader.offsetHeight;
    const contentH = Math.max(0, panelH - headerH);
    gradesContent.style.height = contentH + 'px';

    const overviewH = overview.offsetHeight;
    // Leave a tiny cushion so we never clip shadows/borders.
    const available = Math.max(120, contentH - overviewH - 4);
    // Always use available space to ensure scrolling works when content overflows
    courses.style.height = available + 'px';
    courses.style.maxHeight = available + 'px';
}

// Assignments: list takes remaining space under the header stats.
const assignmentsPanel = document.getElementById('assignments-panel');
const assignmentsHeader = assignmentsPanel?.querySelector('.panel-header');
const assignmentsContent = document.getElementById('assignments-content');
const stats = assignmentsContent?.querySelector('.assignments-header-stats');
const list = assignmentsContent?.querySelector('.assignments-list');

if (assignmentsPanel && assignmentsHeader && assignmentsContent && stats && list) {
    const panelH = assignmentsPanel.clientHeight;
    const headerH = assignmentsHeader.offsetHeight;
    const contentH = Math.max(0, panelH - headerH);
    assignmentsContent.style.height = contentH + 'px';

    const statsH = stats.offsetHeight;
    const available = Math.max(140, contentH - statsH - 4);
    // Always use available space to ensure scrolling works when content overflows
    list.style.height = available + 'px';
    list.style.maxHeight = available + 'px';
}
}

function setGradesContent(html) {
const gradesEl = document.getElementById('grades-content');
const prevScroll = gradesEl?.querySelector('.courses-section')?.scrollTop || 0;

if (gradesEl) gradesEl.innerHTML = html;

// Wait for DOM to update, then layout and start scrolling
requestAnimationFrame(() => {
    layoutScrollers();
    restoreScroll(gradesEl?.querySelector('.courses-section'), prevScroll);
    // Additional delay to ensure heights are applied
    setTimeout(() => {
        initAutoScrollCourses();
    }, 200);
});
}

function setAssignmentsContent(html) {
const wrapperEl = document.getElementById('assignments-content');
const prevScroll = wrapperEl?.querySelector('.assignments-list')?.scrollTop || 0;

if (wrapperEl) wrapperEl.innerHTML = html;

// Wait for DOM to update, then layout and start scrolling
requestAnimationFrame(() => {
    layoutScrollers();
    restoreScroll(wrapperEl?.querySelector('.assignments-list'), prevScroll);
    // Additional delay to ensure heights are applied
    setTimeout(() => {
        initAutoScroll();
    }, 200);
});
}

// ============ DATA FETCHING ============
async function fetchAll() {
await Promise.all([fetchGrades(), fetchAssignments(), fetchMissing()]);
}

async function fetchGrades() {
try {
    const response = await fetch(`${BACKEND_URL}/grades`);
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.grades) {
        latestGrades = result.grades;
        setGradesContent(displayGrades(latestGrades, latestAssignments));
        document.getElementById('grades-status').textContent = new Date(result.lastUpdated).toLocaleTimeString();
    }
} catch (e) {
    document.getElementById('grades-content').innerHTML = `<div class="error-state"><p>Could not load grades</p><a href="https://410.ncsis.gov/campus/SSO/psu410guilfordco/sis?configID=1" target="_blank" class="login-btn">Log In</a></div>`;
}
}

async function fetchAssignments() {
try {
    const response = await fetch(`${BACKEND_URL}/assignments`);
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.assignments) {
        latestAssignments = result.assignments;
        setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
        if (latestGrades) {
            setGradesContent(displayGrades(latestGrades, latestAssignments));
        }
        document.getElementById('assignments-status').textContent = new Date(result.lastUpdated).toLocaleTimeString();
    }
} catch (e) {
    document.getElementById('assignments-content').innerHTML = `<div class="error-state"><p>Could not load assignments</p></div>`;
}
}

async function fetchMissing() {
try {
    const response = await fetch(`${BACKEND_URL}/missing`);
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.missing) {
        latestMissing = result.missing;
        setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
    }
} catch (e) {
    // Missing data is optional, fail silently
}
}

// ============ WEBSOCKET ============
function connectWebSocket() {
if (ws && ws.readyState === WebSocket.OPEN) return;

try {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('🔗 WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            if (message.type === 'init') {
                if (message.data.grades?.grades) {
                    latestGrades = message.data.grades.grades;
                    setGradesContent(displayGrades(latestGrades, latestAssignments));
                    document.getElementById('grades-status').textContent = 'Live';
                }
                if (message.data.assignments?.assignments) {
                    latestAssignments = message.data.assignments.assignments;
                    setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
                    if (latestGrades) {
                        setGradesContent(displayGrades(latestGrades, latestAssignments));
                    }
                    document.getElementById('assignments-status').textContent = 'Live';
                }
                if (message.data.missing?.missing) {
                    latestMissing = message.data.missing.missing;
                    if (latestAssignments) setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
                }
            } else if (message.type === 'grades') {
                latestGrades = message.data.grades;
                setGradesContent(displayGrades(latestGrades, latestAssignments));
                document.getElementById('grades-status').textContent = 'Updated';
            } else if (message.type === 'assignments') {
                latestAssignments = message.data.assignments;
                setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
                if (latestGrades) {
                    setGradesContent(displayGrades(latestGrades, latestAssignments));
                }
                document.getElementById('assignments-status').textContent = 'Updated';
            } else if (message.type === 'missing') {
                latestMissing = message.data.missing;
                if (latestAssignments) setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
            } else if (message.type === 'settings') {
                // Only reload wallpaper if the image source changed
                const prevSettings = { ...settings };
                const prevSrc = prevSettings.backgroundImage || prevSettings.imageUrl;
                const newSettings = { ...defaultSettings, ...message.data.settings };
                const newSrc = newSettings.backgroundImage || newSettings.imageUrl;

                settings = newSettings;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
                applySettings();
                
                // Update Three.js material uniforms
                if (material) {
                    material.uniforms.uIntensity.value = settings.effectIntensity;
                    material.uniforms.uSpeed.value = settings.animationSpeed;
                    material.uniforms.uMouseReactivity.value = settings.mouseReactivity;
                    material.uniforms.uPreset.value = getPresetIndex(settings.effectPreset);
                    material.uniforms.uFitMode.value = getFitModeIndex(settings.imageFitMode);
                    const c1 = new THREE.Color(settings.primaryColor);
                    const c2 = new THREE.Color(settings.secondaryColor);
                    material.uniforms.uColor1.value.set(c1.r, c1.g, c1.b);
                    material.uniforms.uColor2.value.set(c2.r, c2.g, c2.b);

                    const prevImageUpdated = prevSettings?.['image-updated'] || prevSettings?.imageUpdated || null;
                    const newImageUpdated = newSettings?.['image-updated'] || newSettings?.imageUpdated || null;
                    if (prevSrc !== newSrc || prevImageUpdated !== newImageUpdated) {
                        loadBackgroundImage();
                    } else {
                        console.log('Settings changed but image source and timestamp unchanged — not reloading texture.');
                    }
                }
                
                // Reinitialize particles if settings changed
                if (typeof initParticles === 'function') {
                    initParticles();
                }
            }
        } catch (e) {}
    };
    
    ws.onclose = () => {
        wsReconnectTimer = setTimeout(connectWebSocket, 5000);
    };
} catch (e) {
    wsReconnectTimer = setTimeout(connectWebSocket, 5000);
}
}

// Listen for updates from the extension background script
if (window.chrome && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type) {
      if (message.type === 'grades' && message.payload) {
        latestGrades = message.payload.grades;
        setGradesContent(displayGrades(latestGrades, latestAssignments));
        // Optionally update status/time
        if (message.payload.lastUpdated) {
          const el = document.getElementById('grades-status');
          if (el) el.textContent = new Date(message.payload.lastUpdated).toLocaleTimeString();
        }
      } else if (message.type === 'assignments' && message.payload) {
        latestAssignments = message.payload.assignments;
                setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
        if (latestGrades) {
          setGradesContent(displayGrades(latestGrades, latestAssignments));
        }
        if (message.payload.assignmentsLastUpdated) {
          const el = document.getElementById('assignments-status');
          if (el) el.textContent = new Date(message.payload.assignmentsLastUpdated).toLocaleTimeString();
        }
      } else if (message.type === 'missing' && message.payload) {
        latestMissing = message.payload.missing;
        if (latestAssignments) setAssignmentsContent(displayAssignments(latestAssignments, latestMissing));
            } else if (message.type === 'settings' && message.payload) {
                // Only reload wallpaper when the image source actually changes
                const prevSettings = { ...settings };
                const prevSrc = prevSettings.backgroundImage || prevSettings.imageUrl;
                const incoming = { ...defaultSettings, ...message.payload.settings };
                const newSrc = incoming.backgroundImage || incoming.imageUrl;

                settings = incoming;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
                applySettings();
                // Optionally update Three.js material if needed
                if (material) {
                    material.uniforms.uIntensity.value = settings.effectIntensity;
                    material.uniforms.uSpeed.value = settings.animationSpeed;
                    material.uniforms.uMouseReactivity.value = settings.mouseReactivity;
                    material.uniforms.uPreset.value = getPresetIndex(settings.effectPreset);
                    material.uniforms.uFitMode.value = getFitModeIndex(settings.imageFitMode);
                    const c1 = new THREE.Color(settings.primaryColor);
                    const c2 = new THREE.Color(settings.secondaryColor);
                    material.uniforms.uColor1.value.set(c1.r, c1.g, c1.b);
                    material.uniforms.uColor2.value.set(c2.r, c2.g, c2.b);
                    const prevImageUpdated = prevSettings?.['image-updated'] || prevSettings?.imageUpdated || null;
                    const newImageUpdated = incoming?.['image-updated'] || incoming?.imageUpdated || null;
                    if (prevSrc !== newSrc || prevImageUpdated !== newImageUpdated) {
                        loadBackgroundImage();
                    } else {
                        console.log('Settings changed but image source and timestamp unchanged — not reloading texture.');
                    }
                }
                if (typeof initParticles === 'function') {
                    initParticles();
                }
      }
    }
  });
}

// ============ AUTO-SCROLL ============
function startAutoScroll(el, { speed = 1, delayMs = 2000, pauseAtEnds = 1500 } = {}) {
if (!el) return;

// Clear any existing timers
if (el._autoScrollInterval) {
    clearInterval(el._autoScrollInterval);
    el._autoScrollInterval = null;
}
if (el._autoScrollFrame) {
    cancelAnimationFrame(el._autoScrollFrame);
    el._autoScrollFrame = null;
}
if (el._autoScrollTimeout) {
    clearTimeout(el._autoScrollTimeout);
    el._autoScrollTimeout = null;
}
if (el._autoScrollPauseTimeout) {
    clearTimeout(el._autoScrollPauseTimeout);
    el._autoScrollPauseTimeout = null;
}
if (el._autoScrollRecalcInterval) {
    clearInterval(el._autoScrollRecalcInterval);
    el._autoScrollRecalcInterval = null;
}

let direction = 1; // 1 = down, -1 = up
let paused = false;
let pausedAtEnd = false;
let lastTickTime = null;
let virtualScrollTop = el.scrollTop;
// Cache maxScroll to avoid layout-thrashing reads every frame
let cachedMaxScroll = Math.max(0, el.scrollHeight - el.clientHeight);

// Recalculate maxScroll on a slow timer (not every frame)
el._autoScrollRecalcInterval = setInterval(() => {
    cachedMaxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
}, 2000);

// Pause on hover only if setting is enabled
if (settings.autoScrollPauseOnHover) {
    el.onmouseenter = () => { paused = true; };
    el.onmouseleave = () => {
        paused = false;
        lastTickTime = null;
        virtualScrollTop = el.scrollTop;
    };
} else {
    el.onmouseenter = null;
    el.onmouseleave = null;
}

function tick() {
    // Skip scrolling while hovering or paused at an end
    if (paused || pausedAtEnd) {
        lastTickTime = null;
        virtualScrollTop = el.scrollTop;
        return;
    }

    const now = performance.now();
    const delta = lastTickTime === null ? 16 : Math.min(now - lastTickTime, 64);
    lastTickTime = now;

    if (cachedMaxScroll <= 0) return;

    virtualScrollTop = Math.min(cachedMaxScroll, Math.max(0, virtualScrollTop));

    // Move scroll position
    virtualScrollTop += direction * speed * (delta / 16.67);

    // Check if we hit the bottom
    if (direction === 1 && virtualScrollTop >= cachedMaxScroll) {
        virtualScrollTop = cachedMaxScroll;
        el.scrollTop = cachedMaxScroll;
        direction = -1;
        pausedAtEnd = true;
        el._autoScrollPauseTimeout = setTimeout(() => {
            pausedAtEnd = false;
            lastTickTime = null;
            virtualScrollTop = el.scrollTop;
        }, pauseAtEnds);
    }
    // Check if we hit the top
    else if (direction === -1 && virtualScrollTop <= 0) {
        virtualScrollTop = 0;
        el.scrollTop = 0;
        direction = 1;
        pausedAtEnd = true;
        el._autoScrollPauseTimeout = setTimeout(() => {
            pausedAtEnd = false;
            lastTickTime = null;
            virtualScrollTop = el.scrollTop;
        }, pauseAtEnds);
    } else {
        el.scrollTop = virtualScrollTop;
    }
}

// Start scrolling after delay
el._autoScrollTimeout = setTimeout(() => {
    lastTickTime = null;
    virtualScrollTop = el.scrollTop;
    el._autoScrollInterval = setInterval(tick, 16);
}, delayMs);
}

function initAutoScrollGrades() {
initAutoScrollCourses();
}

function initAutoScrollCourses() {
if (!settings.autoScrollEnabled) return;

const el = document.getElementById('courses-section') || document.querySelector('.courses-section');
if (!el) return;

const speed = settings.autoScrollSpeed || 1;
const delayMs = (settings.autoScrollDelay || 2) * 1000;
const pauseAtEnds = (settings.autoScrollPause || 1) * 1000;

startAutoScroll(el, { speed, delayMs, pauseAtEnds });
}

function initAutoScroll() {
if (!settings.autoScrollEnabled) return;

const el = document.getElementById('assignments-list') || document.querySelector('.assignments-list');
if (!el) return;

const speed = settings.autoScrollSpeed || 1;
const delayMs = (settings.autoScrollDelay || 2) * 1000;
const pauseAtEnds = (settings.autoScrollPause || 1) * 1000;

startAutoScroll(el, { speed, delayMs, pauseAtEnds });
}

// ============ INIT ============
async function initWallpaper() {
await loadSettings();
initThreeJS();
initParticles();
if (!SAFE_MODE) {
    animateThreeJS();
    animateParticles();
}
updateClock();
setInterval(updateClock, 1000);
connectWebSocket();

// Fetch data first, then initialize scrollers
await fetchAll();

// Size scrollers after content is loaded
layoutScrollers();

// Start auto-scroll after a small delay to ensure DOM is ready
setTimeout(() => {
    initAutoScroll();
    initAutoScrollCourses();
}, 500);

setInterval(fetchAll, settings.refreshInterval * 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWallpaper);
} else {
    initWallpaper();
}