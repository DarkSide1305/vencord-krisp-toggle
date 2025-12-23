/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";

// Find Discord's MediaEngineStore which handles voice settings
const MediaEngineStore = findByPropsLazy("setNoiseSuppression", "setEchoCancellation");

// Try to find the state store that has the current values
const MediaEngineState = findByPropsLazy("getState", "getNoiseSuppression");

// Plugin settings
const settings = definePluginSettings({
    keybind: {
        type: OptionType.STRING,
        description: "Keybind to toggle Krisp (e.g., 'ctrl+shift+k')",
        default: "ctrl+shift+k"
    },
    enableStreamDeck: {
        type: OptionType.BOOLEAN,
        description: "Enable Stream Deck integration (HTTP server & state file)",
        default: true,
        restartNeeded: true
    },
    playSounds: {
        type: OptionType.BOOLEAN,
        description: "Play mute/unmute sounds when toggling Krisp",
        default: true
    },
    soundVolume: {
        type: OptionType.SLIDER,
        description: "Volume for toggle sounds (0-100%)",
        default: 50,
        markers: [0, 25, 50, 75, 100],
        stickToMarkers: false
    }
});

let lastKnownMode: "Krisp" | "None" = "None";

function getKrispState(): "Krisp" | "None" | "Standard" | "Transitioning" | "Unknown" {
    try {
        if (MediaEngineState?.getState) {
            const state = MediaEngineState.getState();
            const settings = state.settingsByContext?.default || {};
            
            const currentNoiseSuppression = settings.noiseSuppression;
            const currentNoiseCancellation = settings.noiseCancellation;
            
            if (currentNoiseSuppression === true && currentNoiseCancellation === true) {
                return "Krisp";
            } else if (currentNoiseSuppression === true && currentNoiseCancellation === false) {
                return "Standard";
            } else if (currentNoiseSuppression === false && currentNoiseCancellation === false) {
                return "None";
            } else {
                // NS: false, NC: true - transitioning to Krisp
                return "Transitioning";
            }
        }
    } catch (error) {
        console.error("[Krisp Toggle] Error getting state:", error);
    }
    return "Unknown";
}

// Cache for audio blobs
let audioCache: Record<string, string> = {};

async function loadSoundAsBlob(url: string): Promise<string> {
    if (audioCache[url]) {
        return audioCache[url];
    }
    
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        audioCache[url] = blobUrl;
        return blobUrl;
    } catch (error) {
        console.error("[Krisp Toggle] Error loading sound:", error);
        throw error;
    }
}

async function playSound(soundName: string) {
    if (!settings.store.playSounds) return;
    
    try {
        console.log("[Krisp Toggle] Playing sound:", soundName);
        
        // Discord sound URLs - actual Discord sound files from GitHub
        const soundUrls: Record<string, string> = {
            "mute": "https://raw.githubusercontent.com/lefuturiste/discord-sounds/master/non-muted.mp3",
            "unmute": "https://raw.githubusercontent.com/lefuturiste/discord-sounds/master/muted.mp3"
        };
        
        const url = soundUrls[soundName];
        if (!url) {
            console.warn("[Krisp Toggle] Unknown sound name:", soundName);
            return;
        }
        
        // Load sound as blob to bypass CSP
        const blobUrl = await loadSoundAsBlob(url);
        
        const audio = new Audio();
        audio.src = blobUrl;
        audio.volume = settings.store.soundVolume / 100; // Convert 0-100 to 0-1
        audio.play().catch(err => {
            console.warn("[Krisp Toggle] Could not play audio:", err);
        });
    } catch (error) {
        console.error("[Krisp Toggle] Error playing sound:", error);
    }
}

function toggleKrisp() {
    try {
        // Get the current state
        if (MediaEngineState?.getState) {
            const state = MediaEngineState.getState();
            const settings = state.settingsByContext?.default || {};
            
            const currentNoiseSuppression = settings.noiseSuppression;
            const currentNoiseCancellation = settings.noiseCancellation;
            
            console.log("[Krisp Toggle] Raw values - NS:", currentNoiseSuppression, "(type:", typeof currentNoiseSuppression, ") NC:", currentNoiseCancellation, "(type:", typeof currentNoiseCancellation, ")");
            
            // Determine current mode
            let currentMode: "Krisp" | "Standard" | "None" | "Transitioning";
            if (currentNoiseSuppression === true && currentNoiseCancellation === true) {
                currentMode = "Krisp";
            } else if (currentNoiseSuppression === true && currentNoiseCancellation === false) {
                currentMode = "Standard";
            } else if (currentNoiseSuppression === false && currentNoiseCancellation === false) {
                currentMode = "None";
            } else {
                // NS: false, NC: true - transitioning to Krisp
                currentMode = "Transitioning";
            }
            
            console.log("[Krisp Toggle] Detected mode:", currentMode);
            console.log("[Krisp Toggle] Last known mode:", lastKnownMode);
            
            // Toggle between Krisp and None
            if (currentMode === "Krisp") {
                // Switch to None (turning OFF Krisp = "unmuting" noise)
                console.log("[Krisp Toggle] Switching to None");
                MediaEngineStore.setNoiseCancellation(false);
                // Small delay to ensure first call completes
                setTimeout(() => MediaEngineStore.setNoiseSuppression(false), 10);
                lastKnownMode = "None";
                
                // Play unmute sound (Krisp OFF = more noise allowed)
                playSound("unmute");
            } else if (currentMode === "Transitioning") {
                // If transitioning to Krisp, treat it as if already on Krisp and switch to None
                console.log("[Krisp Toggle] Detected transitioning state, switching to None");
                MediaEngineStore.setNoiseCancellation(false);
                setTimeout(() => MediaEngineStore.setNoiseSuppression(false), 10);
                lastKnownMode = "None";
                
                // Play unmute sound
                playSound("unmute");
            } else {
                // Switch to Krisp (from None or Standard) (turning ON Krisp = "muting" noise)
                console.log("[Krisp Toggle] Switching to Krisp");
                MediaEngineStore.setNoiseCancellation(true);
                setTimeout(() => MediaEngineStore.setNoiseSuppression(true), 10);
                lastKnownMode = "Krisp";
                
                // Play mute sound (Krisp ON = suppressing noise)
                playSound("mute");
            }
        }
        
    } catch (error) {
        console.error("[Krisp Toggle] Error toggling Krisp:", error);
    }
}

export default definePlugin({
    name: "KrispToggle",
    description: "Toggle Discord Krisp noise suppression with a GLOBAL hotkey. Works even when Discord is not focused!",
    authors: [{ name: "DarkSide1305", id: 108530201708773376n }],
    
    settings,
    
    start() {
        // Expose toggle function and state getter globally so native code can call it
        (window as any).VencordKrispToggle = {
            toggle: toggleKrisp,
            getState: getKrispState,
            streamDeckEnabled: settings.store.enableStreamDeck
        };
        
        console.log("[Krisp Toggle] Plugin started. Global keybind:", settings.store.keybind);
        console.log("[Krisp Toggle] Stream Deck integration:", settings.store.enableStreamDeck ? "enabled" : "disabled");
        console.log("[Krisp Toggle] Sound effects:", settings.store.playSounds ? "enabled" : "disabled");
        console.log("[Krisp Toggle] HTTP API available on window.VencordKrispToggle");
    },
    
    stop() {
        // Clean up blob URLs
        Object.values(audioCache).forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch (e) {
                // Ignore errors
            }
        });
        audioCache = {};
        
        // Clean up global object
        delete (window as any).VencordKrispToggle;
        console.log("[Krisp Toggle] Plugin stopped");
    }
});