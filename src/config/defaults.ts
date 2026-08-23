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
            "friendly-name": "Windows"
        },
        "mac": {
            "friendly-name": "MacOS"
        },
        "ios": {
            "friendly-name": "iOS"
        },
        "android": {
            "friendly-name": "Android"
        },
        "appletvos": {
            "friendly-name": "AppleTV"
        }
    },
    /*
     * Every assistive technology a functional test can be assigned to, in
     * alphabetical order because the checkbox group is navigated by first
     * letter.
     *
     * One entry per technology, not per technology and platform: the scripter
     * enters the operating system separately, so a single "VoiceOver" covers
     * macOS, iOS, iPadOS, watchOS and tvOS, and a single "Switch Control"
     * covers Apple's and Android's. Entries keep a platform in their name only
     * where the technology exists on that platform alone.
     *
     * Several are test conditions rather than software -- Keyboard-Only Usage,
     * Hardware or Closed Product, Android Tablet. They are still things a
     * script is performed against, so they belong here.
     */
    "at-types": {
        "android-magnification": { "friendly-name": "Android Magnification" },
        "android-tablet": { "friendly-name": "Android Tablet" },
        "android-voice-access": { "friendly-name": "Android Voice Access" },
        "assistivetouch": { "friendly-name": "AssistiveTouch" },
        "audio-guidance": { "friendly-name": "Audio Guidance" },
        "browser-zoom": { "friendly-name": "Browser Zoom (to 200%)" },
        "chromevox": { "friendly-name": "ChromeVox" },
        "dragon-ns": { "friendly-name": "Dragon NaturallySpeaking" },
        "hardware-closed-product": { "friendly-name": "Hardware or Closed Product" },
        "high-contrast-mode": { "friendly-name": "High Contrast Mode" },
        "inverse-colors": { "friendly-name": "Inverse Colors" },
        "jaws": { "friendly-name": "JAWS" },
        "keyboard-only": { "friendly-name": "Keyboard-Only Usage" },
        "larger-text": { "friendly-name": "Larger Text" },
        "no-audio-visual-indication": { "friendly-name": "No Audio/Visual Indication of Audio Information" },
        "nvda": { "friendly-name": "NVDA" },
        "refreshable-braille": { "friendly-name": "Refreshable Braille Display" },
        "switch-control": { "friendly-name": "Switch Control" },
        "talkback": { "friendly-name": "TalkBack" },
        "voice-control": { "friendly-name": "Voice Control" },
        "voiceover": { "friendly-name": "VoiceOver" },
        "voiceview": { "friendly-name": "VoiceView" },
        "windows-magnifier": { "friendly-name": "Windows Magnifier" },
        "windows-narrator": { "friendly-name": "Windows Narrator" },
        "windows-on-screen-keyboard": { "friendly-name": "Windows On-Screen Keyboard" },
        "windows-speech-recognition": { "friendly-name": "Windows Speech Recognition" },
        "zoom": { "friendly-name": "Zoom" },
        "zoomtext": { "friendly-name": "ZoomText" },
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
