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
                // Switch to None
                console.log("[Krisp Toggle] Switching to None");
                MediaEngineStore.setNoiseCancellation(false);
                // Small delay to ensure first call completes
                setTimeout(() => MediaEngineStore.setNoiseSuppression(false), 10);
                lastKnownMode = "None";
            } else if (currentMode === "Transitioning") {
                // If transitioning to Krisp, treat it as if already on Krisp and switch to None
                console.log("[Krisp Toggle] Detected transitioning state, switching to None");
                MediaEngineStore.setNoiseCancellation(false);
                setTimeout(() => MediaEngineStore.setNoiseSuppression(false), 10);
                lastKnownMode = "None";
            } else {
                // Switch to Krisp (from None or Standard)
                console.log("[Krisp Toggle] Switching to Krisp");
                MediaEngineStore.setNoiseCancellation(true);
                setTimeout(() => MediaEngineStore.setNoiseSuppression(true), 10);
                lastKnownMode = "Krisp";
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
        console.log("[Krisp Toggle] HTTP API available on window.VencordKrispToggle");
    },
    
    stop() {
        // Clean up
        delete (window as any).VencordKrispToggle;
        console.log("[Krisp Toggle] Plugin stopped");
    }
});