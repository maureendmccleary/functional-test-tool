import type { Defaults } from '../types.js';

/**
 * Catalogues and score lists that populate the menus.
 *
 * `os-types` is currently unread -- only `at-types` is used, by
 * fillCheckboxMenu. It is kept as the reference list of supported systems.
 */
export const defaults: Defaults = {
    "os-types": {
        "windows": {
            "friendly-name": "Windows",
            "version": "11"
        },
        "mac": {
            "friendly-name": "MacOS",
            "version": "14"
        },
        "ios": {
            "friendly-name": "iOS",
            "version": "16"
        },
        "android": {
            "friendly-name": "Android",
            "version": "15"
        },
        "appletvos": {
            "friendly-name": "AppleTV",
            "version": "16"
        }
    },
    "at-types": {
        "nvda": {
            "friendly-name": "NVDA",
            "version": "2024",
            "os-types": ["windows"]
        },
        "jaws": {
            "friendly-name": "JAWS",
            "version": "2024",
            "os-types": ["windows"]
        },
        "voiceover": {
            "friendly-name": "VoiceOver",
            "version": "same as OS version",
            "os-types": ["mac", "ios", "ipados", "applewatchos", "appletvos"]
        },
        "talkback": {
            "friendly-name": "TalkBack",
            "version": "15",
            "os-types": ["android"]
        },
        "zoomtext": {
            "friendly-name": "ZoomText",
            "version": "2024",
            "os-types": ["windows"]
        },
        "zoom": {
            "friendly-name": "Zoom",
            "version": "Same as OS version",
            "os-types": ["mac", "ios", "ipados", "applewatchos", "appletvos"]
        },
        "dragon-ns": {
            "friendly-name": "Dragon NaturallySpeaking",
            "version": "18",
            "os-types": ["windows"]
        }
    },
    "scores": [
        { value: -1, label: "Not Rated (-1)" },
        { value: 5, label: "Pass - No Accessibility Problem(s) (5)" },
        { value: 4, label: "Pass - Optimizations Suggested (4)" },
        { value: 3, label: "Pass - Minor Accessibility Problem(s) (3)" },
        { value: 2, label: "Fail - Major Accessibility Problem(s) (2)" },
        { value: 1, label: "Fail - Severe Accessibility Problem(s) (1)" }
    ],
    // An issue always represents a problem, so "Pass - No Accessibility Issues" is not a valid issue score.
    "issue-scores": [
        { value: -1, label: "Not Rated (-1)" },
        { value: 4, label: "Pass - Optimizations Suggested (4)" },
        { value: 3, label: "Pass - Minor Accessibility Problem(s) (3)" },
        { value: 2, label: "Fail - Major Accessibility Problem(s) (2)" },
        { value: 1, label: "Fail - Severe Accessibility Problem(s) (1)" }
    ],
};
