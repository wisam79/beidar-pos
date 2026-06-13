import '@testing-library/jest-dom';
import React from 'react';

// Make React available globally for JSX transform
globalThis.React = React;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎵 Web Audio API Mock - Eliminates "not supported" warnings in tests
// ═══════════════════════════════════════════════════════════════════════════════
const AudioContextMock = class {
    createGain() {
        return {
            connect: () => { },
            gain: { value: 1 },
        };
    }
    createOscillator() {
        return {
            connect: () => { },
            start: () => { },
            stop: () => { },
            type: 'sine',
            frequency: { value: 440 },
        };
    }
    createBuffer(_numChannels: number, length: number, sampleRate: number) {
        return {
            length,
            duration: length / sampleRate,
            numberOfChannels: _numChannels,
            sampleRate,
            getChannelData: () => new Float32Array(length),
        };
    }
    createBufferSource() {
        return {
            connect: () => { },
            start: () => { },
            stop: () => { },
            buffer: null,
        };
    }
    resume() {
        return Promise.resolve();
    }
    close() {
        return Promise.resolve();
    }
};

// @ts-expect-error - Mock for testing
globalThis.AudioContext = AudioContextMock;
// @ts-expect-error - Mock for testing  
globalThis.webkitAudioContext = AudioContextMock;

// ═══════════════════════════════════════════════════════════════════════════════
// 📐 ResizeObserver Mock - Required for components that observe size changes
// ═══════════════════════════════════════════════════════════════════════════════
globalThis.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 matchMedia Mock - Required for responsive design and theme detection
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => { },
        removeListener: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        dispatchEvent: () => false,
    }),
});
