        const STORAGE_KEY = 'wallpaperSettings';
        const BACKEND_URL = 'http://localhost:3001';

        // Default settings
        const defaultSettings = {
            backgroundImage: null,
            imageUrl: '',
            imageFitMode: 'cover',
            effectPreset: 'liquid',
            effectIntensity: 50,
            animationSpeed: 30,
            mouseReactivity: 70,
            particlesEnabled: true,
            particleCount: 100,
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
            clockSize: 8,
            clockBgOpacity: 3,
            clockBlur: 20,
            clockBorderGlow: 30,
            clockRadius: 30,
            clockGlassEffect: true,
            qualityLevel: 'medium',
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

        // Theme presets definitions - includes colors and effect settings
        const themePresets = {
            midnight: { primaryColor: '#3b82f6', secondaryColor: '#1e3a8a', glowColor: '#60a5fa', effectPreset: 'wave', panelBlur: 45, panelOpacity: 35 },
            aurora: { primaryColor: '#667eea', secondaryColor: '#764ba2', glowColor: '#a5b4fc', effectPreset: 'liquid', panelBlur: 40, panelOpacity: 42 },
            sunset: { primaryColor: '#f97316', secondaryColor: '#dc2626', glowColor: '#fbbf24', effectPreset: 'ripple', panelBlur: 35, panelOpacity: 50 },
            ocean: { primaryColor: '#06b6d4', secondaryColor: '#0891b2', glowColor: '#67e8f9', effectPreset: 'wave', panelBlur: 50, panelOpacity: 38 },
            forest: { primaryColor: '#22c55e', secondaryColor: '#15803d', glowColor: '#86efac', effectPreset: 'liquid', panelBlur: 42, panelOpacity: 45 },
            neon: { primaryColor: '#d946ef', secondaryColor: '#7c3aed', glowColor: '#f0abfc', effectPreset: 'distort', panelBlur: 30, panelOpacity: 55 },
            minimal: { primaryColor: '#71717a', secondaryColor: '#52525b', glowColor: '#a1a1aa', effectPreset: 'none', panelBlur: 20, panelOpacity: 70 },
            warm: { primaryColor: '#ef4444', secondaryColor: '#b91c1c', glowColor: '#fca5a5', effectPreset: 'ripple', panelBlur: 38, panelOpacity: 48 },
            cyberpunk: { primaryColor: '#facc15', secondaryColor: '#ea580c', glowColor: '#fde047', effectPreset: 'distort', panelBlur: 25, panelOpacity: 60 }
        };

        let currentSettings = { ...defaultSettings };

        // Load settings on page load
        document.addEventListener('DOMContentLoaded', async () => {
            await loadSettings();
            setupEventListeners();
        });

        async function loadSettings() {
            // 0) Try loading from backend server first (if running)
            try {
                const resp = await fetch(`${BACKEND_URL}/settings`);
                if (resp.ok) {
                    const serverData = await resp.json();
                    if (serverData && serverData.settings) {
                        currentSettings = { ...defaultSettings, ...serverData.settings };
                        // persist to localStorage for consistency
                        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings)); } catch (e) {}
                        applySettingsToUI();
                        return;
                    }
                }
            } catch (e) {
                // backend not reachable, continue with local file attempts
            }

            // First, try to load settings from a local file if present
            try {
                const local = await tryLoadLocalSettingsFile();
                if (local && typeof local === 'object') {
                    currentSettings = { ...defaultSettings, ...local };
                    // Persist local file settings into localStorage for consistency
                    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings)); } catch (e) {}
                }
            } catch (e) {
                // ignore file load errors and continue to localStorage
            }

            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                currentSettings = { ...defaultSettings, ...JSON.parse(saved) };
                
                // Normalize particleColor if present as array/string
                if (currentSettings.particleColor) {
                    if (Array.isArray(currentSettings.particleColor)) {
                        const [r,g,b] = currentSettings.particleColor;
                        currentSettings.particleColor = { R: r, G: g, B: b };
                    } else if (typeof currentSettings.particleColor === 'string') {
                        let s = currentSettings.particleColor.trim();
                        if (s.startsWith('#')) {
                            const hex = s.replace('#','');
                            const r = parseInt(hex.slice(0,2), 16);
                            const g = parseInt(hex.slice(2,4), 16);
                            const b = parseInt(hex.slice(4,6), 16);
                            currentSettings.particleColor = { R: r, G: g, B: b };
                        } else if (s.startsWith('rgb')) {
                            const parts = s.match(/\d+/g);
                            if (parts && parts.length >= 3) {
                                const r = parseInt(parts[0], 10);
                                const g = parseInt(parts[1], 10);
                                const b = parseInt(parts[2], 10);
                                currentSettings.particleColor = { R: r, G: g, B: b };
                            }
                        }
                    }
                }

                // Load background image from separate storage if needed
                if (currentSettings.backgroundImage === '__STORED_SEPARATELY__') {
                    const bgImage = localStorage.getItem(STORAGE_KEY + '_bgImage');
                    if (bgImage) {
                        currentSettings.backgroundImage = bgImage;
                    }
                } else if (currentSettings.backgroundImage === '__SERVER_ONLY__') {
                    // Image is only on server, will be loaded via WebSocket/fetch
                    currentSettings.backgroundImage = null;
                }
            }
            applySettingsToUI();
        }

        function applySettingsToUI() {
            // Image
            document.getElementById('imageUrl').value = currentSettings.imageUrl || '';
            document.getElementById('imageFitMode').value = currentSettings.imageFitMode || 'cover';
            if (currentSettings.backgroundImage) {
                showImagePreview(currentSettings.backgroundImage);
            }

            // Effect preset (only preset buttons, not theme buttons)
            document.querySelectorAll('.preset-btn[data-preset]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.preset === currentSettings.effectPreset);
            });

            // Sliders
            setSlider('effectIntensity', 'intensityValue', currentSettings.effectIntensity, '%');
            setSlider('animationSpeed', 'speedValue', currentSettings.animationSpeed, '%');
            setSlider('mouseReactivity', 'reactivityValue', currentSettings.mouseReactivity, '%');
            setSlider('particleCount', 'particleCountValue', currentSettings.particleCount, '');
            setSlider('connectionDistance', 'connectionValue', currentSettings.connectionDistance, 'px');
            setSlider('clockSize', 'clockSizeValue', currentSettings.clockSize, 'rem');
            setSlider('clockBgOpacity', 'clockBgOpacityValue', currentSettings.clockBgOpacity, '%');
            setSlider('clockBlur', 'clockBlurValue', currentSettings.clockBlur, 'px');
            setSlider('clockBorderGlow', 'clockBorderGlowValue', currentSettings.clockBorderGlow, '%');
            setSlider('clockRadius', 'clockRadiusValue', currentSettings.clockRadius, 'px');
            document.getElementById('clockGlassEffect').checked = currentSettings.clockGlassEffect !== false;

            // Toggles
            document.getElementById('particlesEnabled').checked = currentSettings.particlesEnabled;
            document.getElementById('showConnections').checked = currentSettings.showConnections;
            document.getElementById('auroraEnabled').checked = currentSettings.auroraEnabled;
            document.getElementById('showClock').checked = currentSettings.showClock;
            document.getElementById('use24Hour').checked = currentSettings.use24Hour;
            document.getElementById('showDate').checked = currentSettings.showDate;
            document.getElementById('showGrades').checked = currentSettings.showGrades;
            document.getElementById('showAssignments').checked = currentSettings.showAssignments;
            document.getElementById('gradesTermFilter').value = currentSettings.gradesTermFilter || 'current';
            document.getElementById('reduceMotion').checked = currentSettings.reduceMotion;
            document.getElementById('gpuAcceleration').checked = currentSettings.gpuAcceleration;

            // Colors
            setColor('primaryColor', currentSettings.primaryColor);
            setColor('secondaryColor', currentSettings.secondaryColor);
            setColor('glowColor', currentSettings.glowColor);
            // Particle color: normalize if array/object and set color input
            const pColor = currentSettings.particleColor;
            let hexParticle = '#667eea';
            if (pColor) {
                if (Array.isArray(pColor)) {
                    hexParticle = rgbArrayToHex(pColor);
                } else if (typeof pColor === 'object') {
                    hexParticle = rgbObjToHex(pColor);
                } else if (typeof pColor === 'string') {
                    hexParticle = pColor;
                }
            }
            setColor('particleColors', hexParticle);

            // Select & number
            document.getElementById('qualityLevel').value = currentSettings.qualityLevel;
            document.getElementById('refreshInterval').value = currentSettings.refreshInterval;

            // Auto-Scroll
            document.getElementById('autoScrollEnabled').checked = currentSettings.autoScrollEnabled;
            setSlider('autoScrollSpeed', 'autoScrollSpeedValue', currentSettings.autoScrollSpeed, 'x');
            setSlider('autoScrollDelay', 'autoScrollDelayValue', currentSettings.autoScrollDelay, 's');
            setSlider('autoScrollPause', 'autoScrollPauseValue', currentSettings.autoScrollPause, 's');
            document.getElementById('autoScrollPauseOnHover').checked = currentSettings.autoScrollPauseOnHover;

            // Panel Appearance
            setSlider('panelBlur', 'panelBlurValue', currentSettings.panelBlur, 'px');
            setSlider('panelOpacity', 'panelOpacityValue', currentSettings.panelOpacity, '%');
            setSlider('borderGlow', 'borderGlowValue', currentSettings.borderGlow, '%');
            setSlider('panelRadius', 'panelRadiusValue', currentSettings.panelRadius, 'px');
            setSlider('panelGap', 'panelGapValue', currentSettings.panelGap, 'px');
            setSlider('panelWidth', 'panelWidthValue', currentSettings.panelWidth, 'px');
            document.getElementById('panelHoverEffect').checked = currentSettings.panelHoverEffect;
            document.getElementById('glassMorphism').checked = currentSettings.glassMorphism;
            document.getElementById('panelParallax').checked = currentSettings.panelParallax;
            setSlider('panelParallaxIntensity', 'panelParallaxIntensityValue', currentSettings.panelParallaxIntensity, 'px');

            // Typography
            document.getElementById('fontFamily').value = currentSettings.fontFamily;
            setSlider('gradeFontSize', 'gradeFontSizeValue', currentSettings.gradeFontSize, 'rem');
            setSlider('courseNameSize', 'courseNameSizeValue', currentSettings.courseNameSize, 'rem');
            setSlider('textOpacity', 'textOpacityValue', currentSettings.textOpacity, '%');

            // Theme preset
            document.querySelectorAll('#themePresets .preset-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === currentSettings.themePreset);
            });

            // Alerts
            document.getElementById('highlightMissing').checked = currentSettings.highlightMissing;
            document.getElementById('pulseMissing').checked = currentSettings.pulseMissing;
            document.getElementById('showGradeChanges').checked = currentSettings.showGradeChanges;
            setSlider('lowGradeThreshold', 'lowGradeThresholdValue', currentSettings.lowGradeThreshold, '%');
            setColor('alertColor', currentSettings.alertColor);

            // Mouse
            document.getElementById('mouseGlowEnabled').checked = currentSettings.mouseGlowEnabled;
            setSlider('mouseGlowSize', 'mouseGlowSizeValue', currentSettings.mouseGlowSize, 'px');
            setSlider('mouseGlowOpacity', 'mouseGlowOpacityValue', currentSettings.mouseGlowOpacity, '%');
            setColor('mouseGlowColor', currentSettings.mouseGlowColor || '#667eea');
            document.getElementById('cursorTrail').checked = currentSettings.cursorTrail;
        }

        function setSlider(sliderId, valueId, value, suffix) {
            document.getElementById(sliderId).value = value;
            document.getElementById(valueId).textContent = value + suffix;
        }

        function setColor(id, value) {
            document.getElementById(id).value = value;
            document.getElementById(id + 'Text').value = value;
        }

        function hexToRgbObj(hex) {
            if (!hex) return { R: 102, G: 126, B: 234 };
            hex = hex.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            const r = parseInt(hex.slice(0,2), 16);
            const g = parseInt(hex.slice(2,4), 16);
            const b = parseInt(hex.slice(4,6), 16);
            return { R: r, G: g, B: b };
        }

        function rgbArrayToHex(arr) {
            if (!Array.isArray(arr) || arr.length < 3) return '#667eea';
            const [r,g,b] = arr;
            return '#' + [r,g,b].map(n => n.toString(16).padStart(2, '0')).join('');
        }

        function rgbObjToHex(o) {
            if (!o || typeof o !== 'object') return '#667eea';
            const r = o.R ?? o.r ?? 102;
            const g = o.G ?? o.g ?? 126;
            const b = o.B ?? o.b ?? 234;
            return '#' + [r,g,b].map(n => n.toString(16).padStart(2, '0')).join('');
        }

        // Debounce function for live preview and auto-save
        let livePreviewTimeout = null;
        function broadcastLivePreview() {
            // Debounce to avoid too many requests
            if (livePreviewTimeout) clearTimeout(livePreviewTimeout);
            livePreviewTimeout = setTimeout(async () => {
                try {
                    // Always save to localStorage
                    saveToLocalStorage();
                    
                    // Always save to backend server (persistent storage)
                    const settingsToSend = JSON.parse(JSON.stringify(currentSettings));
                    if (settingsToSend.particleColor && typeof settingsToSend.particleColor === 'object') {
                       settingsToSend.particleColor = {
                        R: settingsToSend.particleColor.R,
                        G: settingsToSend.particleColor.G,
                        B: settingsToSend.particleColor.B
                       };
                    }
                    await fetch(`${BACKEND_URL}/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(settingsToSend)
                    });
                    
                    // Only broadcast to wallpaper if live preview is enabled
                    const livePreviewEnabled = document.getElementById('livePreview')?.checked;
                    if (livePreviewEnabled) {
                        // The POST above already broadcasts via WebSocket
                    }
                } catch (e) {
                    // Silent fail for auto-save
                }
            }, 100);
        }
        
        // Save settings to localStorage, storing large image separately
        function saveToLocalStorage() {
            const settingsToSave = { ...currentSettings };
            const bgImage = settingsToSave.backgroundImage;
            
            // Don't store large base64 images in main settings
            if (bgImage && bgImage.length > 10000) {
                settingsToSave.backgroundImage = '__STORED_SEPARATELY__';
                try {
                    localStorage.setItem(STORAGE_KEY + '_bgImage', bgImage);
                } catch (e) {
                    settingsToSave.backgroundImage = '__SERVER_ONLY__';
                    try { localStorage.removeItem(STORAGE_KEY + '_bgImage'); } catch (_) {}
                }
            }

            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
            } catch (e) {
                // If localStorage is full/corrupt, fall back to saving a minimal settings object.
                const minimal = { ...settingsToSave, backgroundImage: '__SERVER_ONLY__' };
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal)); } catch (_) {}
            }
        }

        // Listen for updates from the extension background script
        if (window.chrome && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message && message.type === 'settings' && message.payload) {
                    currentSettings = { ...defaultSettings, ...message.payload.settings };
                    applySettingsToUI();
                }
            });
        }

        function setupEventListeners() {
            // File upload
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('imageUpload');

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    handleImageFile(file);
                }
            });

            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    handleImageFile(file);
                }
            });

            // Preset buttons
            document.querySelectorAll('.preset-btn:not([data-theme])').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.preset-btn:not([data-theme])').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentSettings.effectPreset = btn.dataset.preset;
                    broadcastLivePreview();
                });
            });

            // Sliders
            setupSlider('effectIntensity', 'intensityValue', '%', v => currentSettings.effectIntensity = v);
            setupSlider('animationSpeed', 'speedValue', '%', v => currentSettings.animationSpeed = v);
            setupSlider('mouseReactivity', 'reactivityValue', '%', v => currentSettings.mouseReactivity = v);
            setupSlider('particleCount', 'particleCountValue', '', v => currentSettings.particleCount = v);
            setupSlider('connectionDistance', 'connectionValue', 'px', v => currentSettings.connectionDistance = v);
            setupSlider('clockSize', 'clockSizeValue', 'rem', v => currentSettings.clockSize = v);
            setupSlider('clockBgOpacity', 'clockBgOpacityValue', '%', v => currentSettings.clockBgOpacity = v);
            setupSlider('clockBlur', 'clockBlurValue', 'px', v => currentSettings.clockBlur = v);
            setupSlider('clockBorderGlow', 'clockBorderGlowValue', '%', v => currentSettings.clockBorderGlow = v);
            setupSlider('clockRadius', 'clockRadiusValue', 'px', v => currentSettings.clockRadius = v);
            setupToggle('clockGlassEffect', v => currentSettings.clockGlassEffect = v);

            // Color pickers
            setupColorPicker('primaryColor', v => currentSettings.primaryColor = v);
            setupColorPicker('secondaryColor', v => currentSettings.secondaryColor = v);
            setupColorPicker('glowColor', v => currentSettings.glowColor = v);
            setupColorPicker('alertColor', v => currentSettings.alertColor = v);
            
            // Toggles
            setupToggle('particlesEnabled', v => currentSettings.particlesEnabled = v);
            setupToggle('showConnections', v => currentSettings.showConnections = v);
            setupToggle('auroraEnabled', v => currentSettings.auroraEnabled = v);
            setupToggle('showClock', v => currentSettings.showClock = v);
            setupToggle('use24Hour', v => currentSettings.use24Hour = v);
            setupToggle('showDate', v => currentSettings.showDate = v);
            setupToggle('showGrades', v => currentSettings.showGrades = v);
            setupToggle('showAssignments', v => currentSettings.showAssignments = v);
            document.getElementById('gradesTermFilter').addEventListener('change', (e) => {
                currentSettings.gradesTermFilter = e.target.value;
                broadcastLivePreview();
            });
            setupToggle('reduceMotion', v => currentSettings.reduceMotion = v);
            setupToggle('gpuAcceleration', v => currentSettings.gpuAcceleration = v);                
            
            // Particle color input handling (fix: always update both and settings)
            const particleColorInput = document.getElementById('particleColors');
            const particleColorsTextInput = document.getElementById('particleColorsText');

            function setParticleColor(hex) {
                // Normalize hex
                if (!hex.startsWith('#')) hex = '#' + hex.replace(/[^0-9a-fA-F]/g, '');
                if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
                particleColorInput.value = hex;
                particleColorsTextInput.value = hex;
                currentSettings.particleColor = hexToRgbObj(hex);
                broadcastLivePreview();
            }

            particleColorInput.addEventListener('input', (e) => {
                setParticleColor(e.target.value);
            });

            particleColorsTextInput.addEventListener('input', (e) => {
                setParticleColor(e.target.value);
            });

            particleColorsTextInput.addEventListener('blur', (e) => {
                setParticleColor(e.target.value);
            });

            // Other inputs
            document.getElementById('imageUrl').addEventListener('change', (e) => {
                currentSettings.imageUrl = e.target.value;
                broadcastLivePreview();
            });

            document.getElementById('imageFitMode').addEventListener('change', (e) => {
                currentSettings.imageFitMode = e.target.value;
                broadcastLivePreview();
            });
            document.getElementById('qualityLevel').addEventListener('change', (e) => {
                currentSettings.qualityLevel = e.target.value;
                broadcastLivePreview();
            });
            document.getElementById('refreshInterval').addEventListener('change', (e) => {
                currentSettings.refreshInterval = parseInt(e.target.value);
                broadcastLivePreview();
            });

            // Import file
            document.getElementById('importFile').addEventListener('change', handleImport);

            // Auto-Scroll
            setupToggle('autoScrollEnabled', v => currentSettings.autoScrollEnabled = v);
            setupSlider('autoScrollSpeed', 'autoScrollSpeedValue', 'x', v => currentSettings.autoScrollSpeed = v);
            setupSlider('autoScrollDelay', 'autoScrollDelayValue', 's', v => currentSettings.autoScrollDelay = v);
            setupSlider('autoScrollPause', 'autoScrollPauseValue', 's', v => currentSettings.autoScrollPause = v);
            setupToggle('autoScrollPauseOnHover', v => currentSettings.autoScrollPauseOnHover = v);

            // Panel Appearance
            setupSlider('panelBlur', 'panelBlurValue', 'px', v => currentSettings.panelBlur = v);
            setupSlider('panelOpacity', 'panelOpacityValue', '%', v => currentSettings.panelOpacity = v);
            setupSlider('borderGlow', 'borderGlowValue', '%', v => currentSettings.borderGlow = v);
            setupSlider('panelRadius', 'panelRadiusValue', 'px', v => currentSettings.panelRadius = v);
            setupSlider('panelGap', 'panelGapValue', 'px', v => currentSettings.panelGap = v);
            setupSlider('panelWidth', 'panelWidthValue', 'px', v => currentSettings.panelWidth = v);
            setupToggle('panelHoverEffect', v => currentSettings.panelHoverEffect = v);
            setupToggle('glassMorphism', v => currentSettings.glassMorphism = v);
            setupToggle('panelParallax', v => currentSettings.panelParallax = v);
            setupSlider('panelParallaxIntensity', 'panelParallaxIntensityValue', 'px', v => currentSettings.panelParallaxIntensity = v);

            // Typography
            document.getElementById('fontFamily').addEventListener('change', (e) => {
                currentSettings.fontFamily = e.target.value;
                broadcastLivePreview();
            });
            setupSlider('gradeFontSize', 'gradeFontSizeValue', 'rem', v => currentSettings.gradeFontSize = v);
            setupSlider('courseNameSize', 'courseNameSizeValue', 'rem', v => currentSettings.courseNameSize = v);
            setupSlider('textOpacity', 'textOpacityValue', '%', v => currentSettings.textOpacity = v);

            // Theme presets
            document.querySelectorAll('#themePresets .preset-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('#themePresets .preset-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentSettings.themePreset = btn.dataset.theme;
                    // Apply all theme settings
                    const theme = themePresets[btn.dataset.theme];
                    if (theme) {
                        // Colors
                        currentSettings.primaryColor = theme.primaryColor;
                        currentSettings.secondaryColor = theme.secondaryColor;
                        currentSettings.glowColor = theme.glowColor;
                        setColor('primaryColor', theme.primaryColor);
                        setColor('secondaryColor', theme.secondaryColor);
                        setColor('glowColor', theme.glowColor);
                             
                        // Effect preset
                        if (theme.effectPreset) {
                            currentSettings.effectPreset = theme.effectPreset;
                            document.querySelectorAll('.preset-btn[data-preset]').forEach(b => b.classList.remove('active'));
                            document.querySelector(`.preset-btn[data-preset="${theme.effectPreset}"]`)?.classList.add('active');
                        }
                        
                        // Panel settings
                        if (theme.panelBlur !== undefined) {
                            currentSettings.panelBlur = theme.panelBlur;
                            setSlider('panelBlur', 'panelBlurValue', theme.panelBlur, 'px');
                        }
                        if (theme.panelOpacity !== undefined) {
                            currentSettings.panelOpacity = theme.panelOpacity;
                            setSlider('panelOpacity', 'panelOpacityValue', theme.panelOpacity, '%');
                        }
                        
                        broadcastLivePreview();
                    }
                });
            });

            // Alerts
            setupToggle('highlightMissing', v => currentSettings.highlightMissing = v);
            setupToggle('pulseMissing', v => currentSettings.pulseMissing = v);
            setupToggle('showGradeChanges', v => currentSettings.showGradeChanges = v);
            setupSlider('lowGradeThreshold', 'lowGradeThresholdValue', '%', v => currentSettings.lowGradeThreshold = v);
            setupColorPicker('alertColor', v => currentSettings.alertColor = v);

            // Mouse
            setupToggle('mouseGlowEnabled', v => currentSettings.mouseGlowEnabled = v);
            setupSlider('mouseGlowSize', 'mouseGlowSizeValue', 'px', v => currentSettings.mouseGlowSize = v);
            setupSlider('mouseGlowOpacity', 'mouseGlowOpacityValue', '%', v => currentSettings.mouseGlowOpacity = v);
            setupColorPicker('mouseGlowColor', v => currentSettings.mouseGlowColor = v);
            setupToggle('cursorTrail', v => currentSettings.cursorTrail = v);
        }

        function setupSlider(sliderId, valueId, suffix, callback) {
            document.getElementById(sliderId).addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                document.getElementById(valueId).textContent = value + suffix;
                callback(value);
                broadcastLivePreview();
                saveSettings();
            });
        }

        function setupColorPicker(id, callback) {
            const picker = document.getElementById(id);
            const text = document.getElementById(id + 'Text');

            picker.addEventListener('input', (e) => {
                text.value = e.target.value;
                callback(e.target.value);
                broadcastLivePreview();
            });

            text.addEventListener('input', (e) => {
                if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    picker.value = e.target.value;
                    callback(e.target.value);
                    broadcastLivePreview();
                }
            });
        }

        function setupToggle(id, callback) {
            document.getElementById(id).addEventListener('change', (e) => {
                callback(e.target.checked);
                broadcastLivePreview();
                saveSettings();
            });
        }

        function handleImageFile(file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                currentSettings.backgroundImage = base64;
                // mark image update time so wallpaper can detect content changes
                currentSettings['image-updated'] = Date.now();
                showImagePreview(base64);
                showToast('Image uploaded successfully!');
                broadcastLivePreview();
            };
            reader.readAsDataURL(file);
        }

        function showImagePreview(src) {
            const preview = document.getElementById('imagePreview');
            const img = document.getElementById('previewImg');
            img.src = src;
            preview.classList.add('active');
        }

        function removeImage() {
            currentSettings.backgroundImage = null;
            currentSettings['image-updated'] = Date.now();
            document.getElementById('imagePreview').classList.remove('active');
            document.getElementById('imageUpload').value = '';
            showToast('Image removed');
        }

        async function saveSettings() {
            try {
                // Save to localStorage (handles large images separately)
                saveToLocalStorage();

                // Save full settings including image to backend
                try {
                    const settingsToSend = JSON.parse(JSON.stringify(currentSettings));
                    if (settingsToSend.particleColor && typeof settingsToSend.particleColor === 'object') {
                        //settingsToSend.particleColor = [settingsToSend.particleColor.R, settingsToSend.particleColor.G, settingsToSend.particleColor.B];
                        settingsToSend.particleColor = {
                            R: settingsToSend.particleColor.R,
                            G: settingsToSend.particleColor.G,
                            B: settingsToSend.particleColor.B
                        };
                    }
                    await fetch(`${BACKEND_URL}/settings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(settingsToSend)
                    });
                } catch (e) {
                    console.warn('Could not sync to backend:', e);
                }

                showToast('Settings saved!');
            } catch (error) {
                showToast('Error saving settings', true);
                console.error(error);
            }
        }

        function exportSettings() {
            const settingsToExport = JSON.parse(JSON.stringify(currentSettings));
            if (settingsToExport.particleColor && typeof settingsToExport.particleColor === 'object') {
               // settingsToExport.particleColor = [settingsToExport.particleColor.R, settingsToExport.particleColor.G, settingsToExport.particleColor.B];
                settingsToSend.particleColor = {
                    R: settingsToSend.particleColor.R,
                    G: settingsToSend.particleColor.G,
                    B: settingsToSend.particleColor.B
                };
            }
            const dataStr = JSON.stringify(settingsToExport, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'wallpaper-settings.json';
            a.click();
            URL.revokeObjectURL(url);
            showToast('Settings exported!');
        }

        function importSettings() {
            document.getElementById('importFile').click();
        }

        function handleImport(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    currentSettings = { ...defaultSettings, ...imported };
                    // Normalize particleColor
                    if (currentSettings.particleColor) {
                        if (Array.isArray(currentSettings.particleColor)) {
                            const [r,g,b] = currentSettings.particleColor;
                            currentSettings.particleColor = { R: r, G: g, B: b };
                        } else if (typeof currentSettings.particleColor === 'string') {
                            let s = currentSettings.particleColor.trim();
                            if (s.startsWith('#')) {
                                const hex = s.replace('#','');
                                const r = parseInt(hex.slice(0,2), 16);
                                const g = parseInt(hex.slice(2,4), 16);
                                const b = parseInt(hex.slice(4,6), 16);
                                currentSettings.particleColor = { R: r, G: g, B: b };
                            } else if (s.startsWith('rgb')) {
                                const parts = s.match(/\d+/g);
                                if (parts && parts.length >= 3) {
                                    const r = parseInt(parts[0], 10);
                                    const g = parseInt(parts[1], 10);
                                    const b = parseInt(parts[2], 10);
                                    currentSettings.particleColor = { R: r, G: g, B: b };
                                }
                            }
                        }
                    }
                    applySettingsToUI();
                    showToast('Settings imported!');
                } catch (error) {
                    showToast('Invalid settings file', true);
                }
            };
            reader.readAsText(file);
        }

        function resetSettings() {
            if (confirm('Are you sure you want to reset all settings to default?')) {
                currentSettings = { ...defaultSettings };
                localStorage.removeItem(STORAGE_KEY);
                applySettingsToUI();
                document.getElementById('imagePreview').classList.remove('active');
                showToast('Settings reset to default');
            }
        }

        function showToast(message, isError = false) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast' + (isError ? ' error' : '');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        // Attempt to load a local settings file. Supports JSON or JS file.
        async function tryLoadLocalSettingsFile() {
            const isFileProtocol = location.protocol === 'file:' || location.origin === 'null';

            // If we're on file://, many fetch requests will be blocked. Try injecting local JS files
            // that assign a global settings object instead (this works when opening the HTML from disk).
            if (isFileProtocol) {
                // First try to load JSON files by embedding them in an iframe — this avoids fetch() blocking on file://
                const jsonPaths = [];
                try {
                    const abs = new URL('../../data/wallpaper-settings.json', location.href).href;
                    jsonPaths.push(abs);
                } catch (e) {}
                jsonPaths.push('./data/wallpaper-settings.json', '../data/wallpaper-settings.json', './wallpaper-settings.json', '../wallpaper-settings.json', '../../data/wallpaper-settings.json');
                for (const p of jsonPaths) {
                    try {
                        const iframe = document.createElement('iframe');
                        iframe.style.display = 'none';
                        iframe.src = p;
                        document.body.appendChild(iframe);
                        // Wait for load or timeout
                        await new Promise(resolve => { iframe.onload = () => resolve(true); iframe.onerror = () => resolve(false); setTimeout(() => resolve(false), 300); });
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (doc) {
                                const text = (doc.body && doc.body.textContent) || doc.documentElement && doc.documentElement.textContent;
                                if (text) {
                                    try { const parsed = JSON.parse(text); iframe.remove(); return parsed; } catch (e) {}
                                }
                            }
                        } catch (e) {
                            // access denied or parse failed
                        }
                        iframe.remove();
                    } catch (e) {}
                }

                // If JSON iframe attempts failed, try injecting JS files that may set globals
                const tryPaths = [];
                try {
                    const absJs = new URL('../../data/wallpaper-settings.js', location.href).href;
                    tryPaths.push(absJs);
                } catch (e) {}
                tryPaths.push('./data/wallpaper-settings.js', '../data/wallpaper-settings.js', './wallpaper-settings.js', '../wallpaper-settings.js', '../../data/wallpaper-settings.js');

                for (const p of tryPaths) {
                    try {
                        const script = document.createElement('script');
                        script.src = p;
                        script.async = false;
                        document.head.appendChild(script);
                        await new Promise(resolve => { script.onload = () => resolve(true); script.onerror = () => resolve(false); setTimeout(() => resolve(false), 300); });
                        if (window.WALLPAPER_SETTINGS && typeof window.WALLPAPER_SETTINGS === 'object') return window.WALLPAPER_SETTINGS;
                        if (window.__WALLPAPER_SETTINGS__ && typeof window.__WALLPAPER_SETTINGS__ === 'object') return window.__WALLPAPER_SETTINGS__;
                    } catch (e) {
                        // ignore and try next
                    }
                }
            }

            // 1) Try JSON via fetch (works when served over HTTP)
            try {
                const resp = await fetch('../../data/wallpaper-settings.json', { cache: 'no-cache' });
                if (resp.ok) {
                    const obj = await resp.json();
                    return obj;
                }
            } catch (e) {}

            // 2) Try JS file via fetch and attempt to extract JSON or inject as fallback
            try {
                const resp = await fetch('../../data/wallpaper-settings.js', { cache: 'no-cache' });
                if (resp.ok) {
                    const txt = await resp.text();
                    // Try pure JSON parse
                    try { return JSON.parse(txt); } catch (e) {}

                    // Try to extract first {...} block
                    const firstBrace = txt.indexOf('{');
                    const lastBrace = txt.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                        const sub = txt.slice(firstBrace, lastBrace + 1);
                        try { return JSON.parse(sub); } catch (e) {}
                    }

                    // As a last resort, inject the script which may assign a global variable
                    const script = document.createElement('script');
                    script.src = './wallpaper-settings.js';
                    document.head.appendChild(script);
                    // Wait briefly for script to execute
                    await new Promise(resolve => { script.onload = () => resolve(); script.onerror = () => resolve(); setTimeout(resolve, 300); });
                    // Check common global names
                    if (window.WALLPAPER_SETTINGS && typeof window.WALLPAPER_SETTINGS === 'object') return window.WALLPAPER_SETTINGS;
                    if (window.__WALLPAPER_SETTINGS__ && typeof window.__WALLPAPER_SETTINGS__ === 'object') return window.__WALLPAPER_SETTINGS__;
                }
            } catch (e) {}

            return null;
        }